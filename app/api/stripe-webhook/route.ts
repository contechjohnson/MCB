import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Normalize strings for fuzzy matching
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Calculate match score between two strings (0-100)
function getMatchScore(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;
  
  // Simple character-based similarity
  const longer = norm1.length > norm2.length ? norm1 : norm2;
  const shorter = norm1.length > norm2.length ? norm2 : norm1;
  
  if (longer.includes(shorter) && shorter.length > 3) {
    return 90; // Substring match
  }
  
  // Calculate common characters percentage
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return Math.round((matches / longer.length) * 100);
}

// Find matching contact in database
async function findMatchingContact(email: string | null, name: string | null) {
  // First try exact email match
  if (email) {
    const { data: emailMatch } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('email_address', email)
      .single();
    
    if (emailMatch) {
      console.log(`Found contact by email: ${email}`);
      return { contact: emailMatch, confidence: 100 };
    }
  }
  
  // If no email match, try fuzzy name matching
  if (name) {
    const { data: allContacts } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .not('first_name', 'is', null);
    
    if (allContacts) {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const contact of allContacts) {
        // Try matching against various name combinations
        const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
        const scores = [
          getMatchScore(name, fullName),
          getMatchScore(name, contact.first_name),
          getMatchScore(name, contact.last_name),
          getMatchScore(name, contact.facebook_name),
          getMatchScore(name, contact.instagram_name),
        ];
        
        const maxScore = Math.max(...scores);
        
        if (maxScore > bestScore) {
          bestScore = maxScore;
          bestMatch = contact;
        }
      }
      
      if (bestScore >= 85) {
        console.log(`Found contact by name with ${bestScore}% confidence: ${name}`);
        return { contact: bestMatch, confidence: bestScore };
      }
    }
  }
  
  return { contact: null, confidence: 0 };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log('Processing Stripe event:', event.type);

  // Log the event first (for debugging and analytics)
  const logEvent = async (
    eventData: any, 
    matchedContactId?: string, 
    confidence?: number, 
    method?: string,
    status: 'matched' | 'orphaned' | 'refunded' | 'failed' = 'orphaned'
  ) => {
    try {
      await supabaseAdmin
        .from('stripe_webhook_logs')
        .insert({
          event_id: event.id,
          event_type: event.type,
          amount: (eventData.amount || eventData.amount_total || 0) / 100,
          customer_email: eventData.customer_email || eventData.customer_details?.email || null,
          customer_name: eventData.customer_details?.name || eventData.customer_name || null,
          matched_contact_id: matchedContactId || null,
          match_confidence: confidence || 0,
          match_method: method || 'not_matched',
          status: status,
          raw_event: event,
        });
    } catch (logError) {
      console.error('Failed to log Stripe event:', logError);
    }
  };

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Only process payment_intent if it has customer info
      const paymentIntent = event.data.object as any;
      if (!paymentIntent.customer_email && !paymentIntent.receipt_email) {
        console.log('Skipping payment_intent.succeeded - no customer info, waiting for checkout.session.completed');
        // Still log it for debugging but mark as skipped
        await logEvent(paymentIntent, undefined, 0, 'skipped', 'orphaned');
        break;
      }
      // Fall through if we have customer info
    case 'checkout.session.completed':
      const session = event.data.object as any;
      
      // Extract payment details
      const amount = session.amount || session.amount_total || 0; // Amount in cents
      const customerEmail = session.customer_email || session.customer_details?.email || session.receipt_email || null;
      const customerName = session.customer_details?.name || session.customer_name || null;
      const paymentDate = new Date().toISOString();
      
      console.log(`Payment received: $${amount/100} from ${customerEmail || customerName}`);
      
      // Find matching contact
      const { contact, confidence } = await findMatchingContact(customerEmail, customerName);
      
      if (contact) {
        console.log(`Updating contact ${contact.user_id} with payment`);
        
        // Log successful match
        const matchMethod = customerEmail && contact.email_address === customerEmail ? 'email' : 'name_fuzzy';
        await logEvent(session, contact.user_id, confidence, matchMethod, 'matched');
        
        // Determine what was purchased based on amount
        const updateData: any = {
          total_purchased: (contact.total_purchased || 0) + (amount / 100),
          updated_at: paymentDate,
        };
        
        // Track purchase dates based on amount thresholds
        if (amount <= 3000) { // $30 or less - considered "first purchase"
          // Only set first_purchase_date if not already set
          if (!contact.first_purchase_date) {
            updateData.first_purchase_date = paymentDate;
            updateData.first_purchase_amount = amount / 100;
            console.log(`Setting first purchase date: $${amount/100}`);
          }
          
          // Also handle specific discovery call
          if (amount === 2000) { // $20.00 discovery call
            updateData.attended = true;
            console.log('Marking as attended (discovery call payment)');
          }
        } 
        
        if (amount > 3000) { // More than $30 - package purchase
          updateData.package_purchase_date = paymentDate;
          updateData.package_purchase_amount = amount / 100;
          updateData.bought_package = true;
          updateData.sent_package = true; // Assume package was sent if they bought
          console.log(`Setting package purchase date: $${amount/100}`);
        }
        
        // Update contact
        const { error: updateError } = await supabaseAdmin
          .from('contacts')
          .update(updateData)
          .eq('user_id', contact.user_id);
        
        if (updateError) {
          console.error('Error updating contact:', updateError);
        } else {
          console.log('Contact updated successfully');
        }
        
        // Log payment for audit trail
        console.log(`Payment logged: ${customerEmail} - $${amount/100} - Confidence: ${confidence}%`);
        
      } else {
        // Log orphaned payment for manual review
        console.warn(`Orphaned payment: ${customerEmail || customerName} - $${amount/100} - No matching contact found`);
        
        // Log orphaned payment
        await logEvent(session, undefined, 0, 'not_matched', 'orphaned');
      }
      
      break;
      
    case 'payment_intent.payment_failed':
      console.log('Payment failed:', event.data.object);
      break;
      
    case 'charge.refunded':
      const refund = event.data.object as any;
      const refundAmount = refund.amount_refunded || 0;
      const refundEmail = refund.billing_details?.email || null;
      const refundName = refund.billing_details?.name || null;
      
      console.log(`Refund processed: $${refundAmount/100} for ${refundEmail || refundName}`);
      
      // Find matching contact for refund
      const { contact: refundContact } = await findMatchingContact(refundEmail, refundName);
      
      if (refundContact) {
        // Subtract refund from total purchased
        const { error: refundError } = await supabaseAdmin
          .from('contacts')
          .update({
            total_purchased: Math.max(0, (refundContact.total_purchased || 0) - (refundAmount / 100)),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', refundContact.user_id);
        
        if (refundError) {
          console.error('Error processing refund:', refundError);
        } else {
          console.log('Refund processed successfully');
        }
      }
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

// Stripe requires raw body for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};
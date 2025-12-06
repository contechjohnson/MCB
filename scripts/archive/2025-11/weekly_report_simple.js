const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://succdcwblbzikenhhlrz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y2NkY3dibGJ6aWtlbmhobHJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIxNDQyMCwiZXhwIjoyMDc3NzkwNDIwfQ.q4texPwypSX_cShDSjBTjTPSBLNdI3nnRViQtw2zUnw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateReport() {
  console.log('\n================================================================================');
  console.log('MCB ATTRIBUTION SYSTEM - WEEKLY PERFORMANCE REPORT');
  console.log('Date: November 8, 2025');
  console.log('================================================================================');

  try {
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .neq('source', 'instagram_historical');

    if (contactsError) throw contactsError;

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*');

    if (paymentsError) throw paymentsError;

    const { data: metaAds, error: metaAdsError } = await supabase
      .from('meta_ads')
      .select('*')
      .eq('is_active', true);

    if (metaAdsError) throw metaAdsError;

    const totalContacts = contacts.length;
    const hasMcId = contacts.filter(c => c.mc_id).length;
    const hasGhlId = contacts.filter(c => c.ghl_id).length;
    const hasAdId = contacts.filter(c => c.ad_id).length;
    const mcGhlLinked = contacts.filter(c => c.mc_id && c.ghl_id).length;

    const dmQualified = contacts.filter(c => c.dm_qualified_date).length;
    const linkClicked = contacts.filter(c => c.link_click_date).length;
    const callBooked = contacts.filter(c => c.form_submit_date || c.appointment_date).length;
    const meetingHeld = contacts.filter(c => c.appointment_held_date).length;
    const packageSent = contacts.filter(c => c.package_sent_date).length;
    const checkoutStarted = contacts.filter(c => c.checkout_started).length;
    const purchased = contacts.filter(c => c.purchase_date).length;

    const totalRevenue = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const stripeRevenue = payments.filter(p => p.payment_source === 'stripe').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const denefitsRevenue = payments.filter(p => p.payment_source === 'denefits').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const linkedPayments = payments.filter(p => p.contact_id).length;
    const orphanedPayments = payments.length - linkedPayments;

    const sources = {};
    contacts.forEach(c => {
      const src = c.source || 'unknown';
      if (!sources[src]) {
        sources[src] = { total: 0, qualified: 0, booked: 0, attended: 0, purchased: 0, revenue: 0 };
      }
      sources[src].total++;
      if (c.dm_qualified_date) sources[src].qualified++;
      if (c.appointment_date) sources[src].booked++;
      if (c.appointment_held_date) sources[src].attended++;
      if (c.purchase_date) sources[src].purchased++;
      sources[src].revenue += parseFloat(c.purchase_amount || 0);
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentContacts = contacts.filter(c => new Date(c.created_at) >= sevenDaysAgo);
    const recentQualified = contacts.filter(c => c.dm_qualified_date && new Date(c.dm_qualified_date) >= sevenDaysAgo);
    const recentBookings = contacts.filter(c => c.appointment_date && new Date(c.appointment_date) >= sevenDaysAgo);
    const recentMeetings = contacts.filter(c => c.appointment_held_date && new Date(c.appointment_held_date) >= sevenDaysAgo);
    const recentPurchases = contacts.filter(c => c.purchase_date && new Date(c.purchase_date) >= sevenDaysAgo);

    const totalSpend = metaAds.reduce((sum, ad) => sum + (parseFloat(ad.spend) || 0), 0);
    const totalImpressions = metaAds.reduce((sum, ad) => sum + (parseInt(ad.impressions) || 0), 0);
    const totalClicks = metaAds.reduce((sum, ad) => sum + (parseInt(ad.clicks) || 0), 0);
    const totalLeads = metaAds.reduce((sum, ad) => sum + (parseInt(ad.leads) || 0), 0);

    console.log('\n### 1. DATABASE OVERVIEW ###\n');
    console.log('Total Contacts: ' + totalContacts);
    console.log('ManyChat ID Capture: ' + hasMcId + ' (' + (hasMcId/totalContacts*100).toFixed(1) + '%)');
    console.log('GoHighLevel ID Capture: ' + hasGhlId + ' (' + (hasGhlId/totalContacts*100).toFixed(1) + '%)');
    console.log('Ad ID Capture: ' + hasAdId + ' (' + (hasAdId/totalContacts*100).toFixed(1) + '%)');
    console.log('MC<->GHL Linkage: ' + mcGhlLinked + ' (' + (mcGhlLinked/totalContacts*100).toFixed(1) + '%)');

    console.log('\n### 2. FUNNEL PERFORMANCE ###\n');
    console.log('Total Contacts: ' + totalContacts);
    console.log('DM Qualified: ' + dmQualified + ' (' + (dmQualified/totalContacts*100).toFixed(1) + '%)');
    console.log('Link Clicked: ' + linkClicked + ' (' + (dmQualified > 0 ? (linkClicked/dmQualified*100).toFixed(1) : 0) + '% of qualified)');
    console.log('Call Booked: ' + callBooked + ' (' + (linkClicked > 0 ? (callBooked/linkClicked*100).toFixed(1) : 0) + '% of clicked)');
    console.log('Meeting Held: ' + meetingHeld + ' (' + (callBooked > 0 ? (meetingHeld/callBooked*100).toFixed(1) : 0) + '% show rate)');
    console.log('Package Sent: ' + packageSent);
    console.log('Checkout Started: ' + checkoutStarted);
    console.log('Purchased: ' + purchased + ' (' + (meetingHeld > 0 ? (purchased/meetingHeld*100).toFixed(1) : 0) + '% close rate)');
    console.log('Overall Conversion: ' + (purchased/totalContacts*100).toFixed(1) + '%');

    console.log('\n### 3. REVENUE METRICS ###\n');
    console.log('Total Payments: ' + payments.length);
    console.log('Total Revenue: $' + totalRevenue.toFixed(2));
    console.log('Stripe Revenue: $' + stripeRevenue.toFixed(2) + ' (' + payments.filter(p => p.payment_source === 'stripe').length + ' payments)');
    console.log('Denefits Revenue: $' + denefitsRevenue.toFixed(2) + ' (' + payments.filter(p => p.payment_source === 'denefits').length + ' payments)');
    console.log('Average Order Value: $' + (totalRevenue/payments.length).toFixed(2));
    console.log('Linked Payments: ' + linkedPayments);
    console.log('Orphaned Payments: ' + orphanedPayments + ' (' + (orphanedPayments/payments.length*100).toFixed(1) + '%)');

    console.log('\n### 4. SOURCE ATTRIBUTION ###\n');
    Object.entries(sources).forEach(([source, metrics]) => {
      console.log('\n' + source.toUpperCase() + ':');
      console.log('  Total: ' + metrics.total);
      console.log('  DM Qualified: ' + metrics.qualified);
      console.log('  Booked: ' + metrics.booked);
      console.log('  Attended: ' + metrics.attended);
      console.log('  Purchased: ' + metrics.purchased);
      console.log('  Revenue: $' + metrics.revenue.toFixed(2));
      console.log('  Conversion Rate: ' + (metrics.purchased/metrics.total*100).toFixed(1) + '%');
    });

    console.log('\n### 5. RECENT ACTIVITY (Last 7 Days) ###\n');
    console.log('New Contacts: ' + recentContacts.length);
    console.log('DM Qualified: ' + recentQualified.length);
    console.log('Bookings: ' + recentBookings.length);
    console.log('Meetings Held: ' + recentMeetings.length);
    console.log('Purchases: ' + recentPurchases.length);

    console.log('\n### 6. META ADS PERFORMANCE ###\n');
    console.log('Active Ads: ' + metaAds.length);
    console.log('Total Spend: $' + totalSpend.toFixed(2));
    console.log('Total Impressions: ' + totalImpressions.toLocaleString());
    console.log('Total Clicks: ' + totalClicks.toLocaleString());
    console.log('Total Leads: ' + totalLeads);
    console.log('Average CTR: ' + (totalImpressions > 0 ? (totalClicks/totalImpressions*100).toFixed(2) : 0) + '%');
    console.log('Average CPC: $' + (totalClicks > 0 ? (totalSpend/totalClicks).toFixed(2) : 0));
    console.log('Cost Per Lead: $' + (totalLeads > 0 ? (totalSpend/totalLeads).toFixed(2) : 0));

    console.log('\n### TOP 5 ADS BY SPEND ###\n');
    const topAds = metaAds.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend)).slice(0, 5);
    topAds.forEach((ad, i) => {
      const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions * 100).toFixed(2) : 0;
      const cpc = ad.clicks > 0 ? (ad.spend / ad.clicks).toFixed(2) : 0;
      console.log((i + 1) + '. ' + ad.ad_name);
      console.log('   Spend: $' + parseFloat(ad.spend).toFixed(2) + ' | Clicks: ' + ad.clicks + ' | CTR: ' + ctr + '% | CPC: $' + cpc);
    });

    if (totalSpend > 0) {
      const roas = totalRevenue / totalSpend;
      console.log('\n### 7. ROAS CALCULATION ###\n');
      console.log('Total Ad Spend: $' + totalSpend.toFixed(2));
      console.log('Total Revenue: $' + totalRevenue.toFixed(2));
      console.log('ROAS: ' + roas.toFixed(2) + 'x');
      console.log('\nNote: ROAS may be understated due to attribution gaps (only ' + (hasAdId/totalContacts*100).toFixed(1) + '% ad_id capture rate)');
    }

    console.log('\n### 8. KEY INSIGHTS & RECOMMENDATIONS ###\n');
    
    console.log('STRENGTHS:');
    console.log('- Strong ManyChat capture: ' + (hasMcId/totalContacts*100).toFixed(1) + '% of contacts have MC_ID');
    if (meetingHeld > 0 && purchased > 0) {
      console.log('- Good close rate: ' + (purchased/meetingHeld*100).toFixed(1) + '% of meetings convert to purchases');
    }
    if (payments.length > 0) {
      console.log('- Average order value: $' + (totalRevenue/payments.length).toFixed(2));
    }

    console.log('\nCRITICAL ISSUES:');
    if (mcGhlLinked / totalContacts < 0.2) {
      console.log('- LOW MC<->GHL linkage rate: ' + (mcGhlLinked/totalContacts*100).toFixed(1) + '% (need >50% for full funnel tracking)');
      console.log('  Action: Investigate email matching logic in GHL webhook');
    }
    if (orphanedPayments > 0) {
      console.log('- ' + orphanedPayments + ' orphaned payments ($' + payments.filter(p => !p.contact_id).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0).toFixed(2) + ')');
      console.log('  Action: Check email matching in payment webhooks');
    }
    if (hasAdId / totalContacts < 0.5) {
      console.log('- Low ad attribution: ' + (hasAdId/totalContacts*100).toFixed(1) + '% (limits ROAS accuracy)');
      console.log('  Action: Verify Meta permissions and ManyChat parameter passing');
    }

    console.log('\nRECOMMENDATIONS:');
    if (dmQualified / totalContacts < 0.5) {
      console.log('- Focus on improving DM qualification rate (currently ' + (dmQualified/totalContacts*100).toFixed(1) + '%)');
    }
    if (linkClicked / dmQualified < 0.7) {
      console.log('- Improve link click rate from qualified leads (currently ' + (linkClicked/dmQualified*100).toFixed(1) + '%)');
    }
    if (callBooked / linkClicked < 0.5) {
      console.log('- Optimize landing page conversion (currently ' + (callBooked/linkClicked*100).toFixed(1) + '%)');
    }
    console.log('- Continue monitoring ROAS as attribution improves');
    console.log('- Test A/B variants once sufficient data volume');

    console.log('\n================================================================================');
    console.log('Report Complete - ' + new Date().toISOString());
    console.log('================================================================================\n');

  } catch (error) {
    console.error('Error generating report:', error);
  }
}

generateReport();

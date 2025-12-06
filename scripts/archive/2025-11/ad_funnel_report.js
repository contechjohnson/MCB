require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function generateReport() {
  console.log('=== OVERALL FUNNEL PERFORMANCE (Nov 6-13, 2025) ===\n');
  
  const { data: funnel, error: funnelError } = await supabase
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical');
  
  if (funnelError) {
    console.error('Error:', funnelError);
    return;
  }
  
  const newContacts = funnel.filter(c => c.created_at >= '2025-11-06' && c.created_at < '2025-11-14').length;
  const dmQualified = funnel.filter(c => c.dm_qualified_date >= '2025-11-06' && c.dm_qualified_date < '2025-11-14').length;
  const linkSent = funnel.filter(c => c.link_send_date >= '2025-11-06' && c.link_send_date < '2025-11-14').length;
  const formFilled = funnel.filter(c => c.form_submit_date >= '2025-11-06' && c.form_submit_date < '2025-11-14').length;
  const meetingHeld = funnel.filter(c => c.appointment_held_date >= '2025-11-06' && c.appointment_held_date < '2025-11-14').length;
  const purchases = funnel.filter(c => c.purchase_date >= '2025-11-06' && c.purchase_date < '2025-11-14').length;
  const totalRevenue = funnel
    .filter(c => c.purchase_date >= '2025-11-06' && c.purchase_date < '2025-11-14')
    .reduce((sum, c) => sum + (parseFloat(c.purchase_amount) || 0), 0);
  
  console.log('New Contacts: ' + newContacts);
  console.log('DM Qualified: ' + dmQualified + ' (' + (newContacts > 0 ? (dmQualified/newContacts*100).toFixed(1) : 0) + '%)');
  console.log('Link Sent: ' + linkSent + ' (' + (dmQualified > 0 ? (linkSent/dmQualified*100).toFixed(1) : 0) + '%)');
  console.log('Form Filled: ' + formFilled + ' (' + (linkSent > 0 ? (formFilled/linkSent*100).toFixed(1) : 0) + '%)');
  console.log('Meeting Held: ' + meetingHeld + ' (' + (formFilled > 0 ? (meetingHeld/formFilled*100).toFixed(1) : 0) + '%)');
  console.log('Purchases: ' + purchases + ' (' + (meetingHeld > 0 ? (purchases/meetingHeld*100).toFixed(1) : 0) + '%)');
  console.log('Total Revenue: $' + totalRevenue.toFixed(2) + '\n');
  
  console.log('=== PERFORMANCE BY AD_ID ===\n');
  
  const contactsByAdId = funnel
    .filter(c => c.created_at >= '2025-11-06' && c.created_at < '2025-11-14')
    .reduce((acc, c) => {
      const adId = c.ad_id || 'NO_AD_ID';
      if (!acc[adId]) acc[adId] = [];
      acc[adId].push(c);
      return acc;
    }, {});
  
  const { data: metaAds } = await supabase.from('meta_ads').select('*');
  const { data: creatives } = await supabase.from('meta_ad_creatives').select('*');
  
  const metaAdsMap = {};
  const creativesMap = {};
  
  if (metaAds) metaAds.forEach(ad => { metaAdsMap[ad.ad_id] = ad; });
  if (creatives) creatives.forEach(c => { creativesMap[c.ad_id] = c; });
  
  const adPerformance = [];
  
  for (const adId in contactsByAdId) {
    const contacts = contactsByAdId[adId];
    const totalContacts = contacts.length;
    const dmQualifiedCount = contacts.filter(c => c.dm_qualified_date).length;
    const linkSentCount = contacts.filter(c => c.link_send_date).length;
    const formFilledCount = contacts.filter(c => c.form_submit_date).length;
    const meetingHeldCount = contacts.filter(c => c.appointment_held_date).length;
    const purchasesCount = contacts.filter(c => c.purchase_date).length;
    const revenue = contacts.reduce((sum, c) => sum + (parseFloat(c.purchase_amount) || 0), 0);
    
    const metaAd = metaAdsMap[adId];
    const creative = creativesMap[adId];
    
    adPerformance.push({
      adId,
      adName: metaAd ? metaAd.ad_name : 'Unknown',
      totalContacts,
      dmQualifiedCount,
      dmQualifiedRate: totalContacts > 0 ? (dmQualifiedCount/totalContacts*100).toFixed(1) : '0.0',
      linkSentCount,
      linkSentRate: dmQualifiedCount > 0 ? (linkSentCount/dmQualifiedCount*100).toFixed(1) : '0.0',
      formFilledCount,
      formFilledRate: linkSentCount > 0 ? (formFilledCount/linkSentCount*100).toFixed(1) : '0.0',
      meetingHeldCount,
      meetingHeldRate: formFilledCount > 0 ? (meetingHeldCount/formFilledCount*100).toFixed(1) : '0.0',
      purchasesCount,
      purchasesRate: meetingHeldCount > 0 ? (purchasesCount/meetingHeldCount*100).toFixed(1) : '0.0',
      revenue,
      spend: metaAd ? metaAd.spend : 0,
      roas: metaAd && metaAd.spend > 0 ? (revenue / metaAd.spend).toFixed(2) : '0.00',
      cpl: metaAd && metaAd.spend > 0 ? (metaAd.spend / totalContacts).toFixed(2) : '0.00',
      theme: creative ? creative.transformation_theme : 'Unknown',
      symptoms: creative ? creative.symptom_focus : [],
      mediaType: creative ? creative.media_type : 'Unknown',
      contacts
    });
  }
  
  adPerformance.sort((a, b) => b.totalContacts - a.totalContacts);
  
  console.log('Ad Performance Summary:');
  adPerformance.forEach(ad => {
    console.log('\nAD_ID: ' + ad.adId);
    console.log('Ad Name: ' + ad.adName);
    console.log('Total Contacts: ' + ad.totalContacts);
    console.log('DM Qualified: ' + ad.dmQualifiedCount + ' (' + ad.dmQualifiedRate + '%)');
    console.log('Link Sent: ' + ad.linkSentCount + ' (' + ad.linkSentRate + '%)');
    console.log('Form Filled: ' + ad.formFilledCount + ' (' + ad.formFilledRate + '%)');
    console.log('Meeting Held: ' + ad.meetingHeldCount + ' (' + ad.meetingHeldRate + '%)');
    console.log('Purchases: ' + ad.purchasesCount + ' (' + ad.purchasesRate + '%)');
    console.log('Revenue: $' + ad.revenue.toFixed(2));
    console.log('Spend: $' + ad.spend);
    console.log('ROAS: ' + ad.roas);
    console.log('Cost per Lead: $' + ad.cpl);
    console.log('Theme: ' + ad.theme);
    console.log('Media Type: ' + ad.mediaType);
  });
  
  console.log('\n\n=== AD CREATIVE ANALYSIS ===\n');
  
  const themePerformance = {};
  adPerformance.filter(ad => ad.adId !== 'NO_AD_ID').forEach(ad => {
    const theme = ad.theme;
    if (!themePerformance[theme]) {
      themePerformance[theme] = { contacts: 0, purchases: 0, revenue: 0, spend: 0 };
    }
    themePerformance[theme].contacts += ad.totalContacts;
    themePerformance[theme].purchases += ad.purchasesCount;
    themePerformance[theme].revenue += ad.revenue;
    themePerformance[theme].spend += parseFloat(ad.spend);
  });
  
  console.log('Performance by Theme:');
  for (const theme in themePerformance) {
    const perf = themePerformance[theme];
    const convRate = perf.contacts > 0 ? (perf.purchases/perf.contacts*100).toFixed(1) : '0.0';
    const roas = perf.spend > 0 ? (perf.revenue/perf.spend).toFixed(2) : '0.00';
    console.log('\n' + theme + ':');
    console.log('  Contacts: ' + perf.contacts);
    console.log('  Purchases: ' + perf.purchases + ' (' + convRate + '%)');
    console.log('  Revenue: $' + perf.revenue.toFixed(2));
    console.log('  Spend: $' + perf.spend.toFixed(2));
    console.log('  ROAS: ' + roas);
  }
  
  const noAdIdPerf = adPerformance.find(ad => ad.adId === 'NO_AD_ID');
  if (noAdIdPerf) {
    console.log('\n\n=== CONTACTS WITHOUT AD_ID ===\n');
    console.log('Total: ' + noAdIdPerf.totalContacts);
    console.log('Purchases: ' + noAdIdPerf.purchasesCount + ' (' + noAdIdPerf.purchasesRate + '%)');
    console.log('Revenue: $' + noAdIdPerf.revenue.toFixed(2));
    
    const sources = {};
    noAdIdPerf.contacts.forEach(c => {
      sources[c.source] = (sources[c.source] || 0) + 1;
    });
    console.log('\nSources:');
    for (const source in sources) {
      console.log('  ' + source + ': ' + sources[source]);
    }
  }
  
  console.log('\n\n=== TOP PERFORMING ADS ===\n');
  
  const adsWithContacts = adPerformance.filter(ad => ad.adId !== 'NO_AD_ID' && ad.totalContacts > 0);
  
  if (adsWithContacts.length > 0) {
    const topByContacts = adsWithContacts[0];
    console.log('Best Ad by Total Contacts:');
    console.log('  ' + topByContacts.adName + ' (' + topByContacts.adId + ')');
    console.log('  Contacts: ' + topByContacts.totalContacts);
    
    const topByConversion = adsWithContacts.slice().sort((a, b) => 
      parseFloat(b.purchasesRate) - parseFloat(a.purchasesRate)
    )[0];
    console.log('\nBest Ad by Conversion Rate:');
    console.log('  ' + topByConversion.adName + ' (' + topByConversion.adId + ')');
    console.log('  Conversion: ' + topByConversion.purchasesRate + '%');
    
    const topByRevenue = adsWithContacts.slice().sort((a, b) => b.revenue - a.revenue)[0];
    console.log('\nBest Ad by Revenue:');
    console.log('  ' + topByRevenue.adName + ' (' + topByRevenue.adId + ')');
    console.log('  Revenue: $' + topByRevenue.revenue.toFixed(2));
    
    const topByRoas = adsWithContacts.slice().sort((a, b) => parseFloat(b.roas) - parseFloat(a.roas))[0];
    console.log('\nBest Ad by ROAS:');
    console.log('  ' + topByRoas.adName + ' (' + topByRoas.adId + ')');
    console.log('  ROAS: ' + topByRoas.roas);
  }
  
  console.log('\n\n=== DETAILED CONTACT LIST BY AD_ID ===\n');
  
  adPerformance.forEach(ad => {
    console.log('\n--- ' + ad.adName + ' (' + ad.adId + ') ---');
    ad.contacts.forEach(c => {
      const daysInFunnel = Math.floor((new Date('2025-11-13') - new Date(c.created_at)) / (1000 * 60 * 60 * 24));
      console.log('  ' + c.first_name + ' ' + c.last_name + ' (' + c.email_primary + ')');
      console.log('    Stage: ' + c.stage);
      console.log('    Purchase: ' + (c.purchase_amount ? '$' + c.purchase_amount : 'No'));
      console.log('    Days in funnel: ' + daysInFunnel);
    });
  });
  
  console.log('\n\n=== RAW DATA (JSON) ===\n');
  console.log(JSON.stringify({
    overall: { newContacts, dmQualified, linkSent, formFilled, meetingHeld, purchases, totalRevenue },
    adPerformance,
    themePerformance
  }, null, 2));
}

generateReport().catch(console.error);

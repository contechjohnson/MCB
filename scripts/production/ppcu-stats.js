#!/usr/bin/env node
/**
 * PPCU Stats - Leads & Meetings (from GHL)
 *
 * Shows:
 * 1. New Leads breakdown (from GHL contacts):
 *    - ManyChat vs Other (has MC_ID custom field or not)
 *    - Ad Attributed vs Not (has AD_ID custom field or not)
 *    - Must have email OR phone to count
 *
 * 2. Meetings Held breakdown (from GHL pipelines):
 *    - Calendly Free (FREE DISCOVERY CALL PIPELINE)
 *    - Jane Paid (Discovery Call Main Pipeline)
 *
 * Usage:
 *   node scripts/production/ppcu-stats.js "last 7 days"
 *   node scripts/production/ppcu-stats.js "last 30 days"
 *   node scripts/production/ppcu-stats.js "december 2025"
 */

// GHL Config
const GHL_LOCATION_ID = 'ep0g6pacgWxOebjWoJUE';
const GHL_API_KEY = 'pit-96165432-f9cd-4ec4-9395-7826a0ee0dc5';

// Custom Field IDs
const AD_ID_FIELD = 'AqpaXqbSl40QJlnsX5Sn';
const MC_ID_FIELD = 'qeXNjfM5QqZhWCBUTmN7';

// Pipeline config
const CALENDLY_PIPELINE_ID = 'sA2y4qH24zyLlLo8YucW';
const JANE_PIPELINE_ID = 'ElSWHXWlapgoSelwKHWP';
const CALENDLY_EXCLUDE_STAGES = ['DC BOOKED', 'NO SHOW'];

/**
 * Parse date argument into start/end dates
 */
function parseDateArg(arg) {
  const today = new Date();

  const formatGHL = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
  };

  const formatISO = (d) => d.toISOString();

  const formatDisplay = (d) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  arg = (arg || 'last 7 days').toLowerCase().trim();

  // "last N days"
  const lastDaysMatch = arg.match(/last\s+(\d+)\s+days?/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[1]);
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return {
      startGHL: formatGHL(start),
      endGHL: formatGHL(end),
      startISO: formatISO(start),
      endISO: formatISO(end),
      display: `Last ${days} Days (${formatDisplay(start)} - ${formatDisplay(today)})`
    };
  }

  // "month year"
  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  const monthMatch = arg.match(/^(\w+)\s+(\d{4})$/);
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const year = parseInt(monthMatch[2]);
    if (months[monthName] !== undefined) {
      const monthNum = months[monthName];
      const start = new Date(year, monthNum, 1);
      const end = new Date(year, monthNum + 1, 0, 23, 59, 59, 999);
      return {
        startGHL: formatGHL(start),
        endGHL: formatGHL(end),
        startISO: formatISO(start),
        endISO: formatISO(end),
        display: `${monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1)} ${year}`
      };
    }
  }

  // Default: last 7 days
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return {
    startGHL: formatGHL(start),
    endGHL: formatGHL(today),
    startISO: formatISO(start),
    endISO: formatISO(today),
    display: `Last 7 Days (${formatDisplay(start)} - ${formatDisplay(today)})`
  };
}

/**
 * Get contacts from GHL within date range
 * GHL returns contacts in descending order by dateAdded
 * We paginate until we hit contacts older than our start date
 */
async function getAllContacts(startDate, endDate) {
  const contacts = [];
  let nextPageUrl = null;
  let page = 0;
  const startDateTime = new Date(startDate).getTime();
  const endDateTime = new Date(endDate).getTime();

  while (true) {
    const url = nextPageUrl ||
      `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=100`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: '2021-07-28',
        Accept: 'application/json'
      }
    });

    const data = await res.json();
    const batch = data.contacts || [];

    if (batch.length === 0) break;

    // Filter contacts within date range
    let hitOldContacts = false;
    for (const contact of batch) {
      const contactDate = new Date(contact.dateAdded).getTime();

      if (contactDate < startDateTime) {
        // We've gone past our date range (contacts are in descending order)
        hitOldContacts = true;
        break;
      }

      if (contactDate <= endDateTime) {
        contacts.push(contact);
      }
    }

    if (hitOldContacts) break;

    // Use the nextPageUrl from meta for proper pagination
    nextPageUrl = data.meta?.nextPageUrl;
    if (!nextPageUrl) break;

    page++;

    // Safety limit
    if (page > 100) {
      console.log(' (hit 10,000 contact limit)');
      break;
    }

    // Progress indicator every 10 pages
    if (page % 10 === 0) {
      process.stdout.write('.');
    }
  }

  return contacts;
}

/**
 * Analyze contacts for lead breakdowns
 */
function analyzeLeads(contacts) {
  // Filter: must have email OR phone
  const validLeads = contacts.filter(c => c.email || c.phone);

  // Helper to check custom field
  const hasField = (contact, fieldId) => {
    if (!contact.customFields) return false;
    const field = contact.customFields.find(f => f.id === fieldId);
    return field && field.value;
  };

  const results = {
    total: validLeads.length,
    bySource: {
      manychat: validLeads.filter(c => hasField(c, MC_ID_FIELD)).length,
      other: validLeads.filter(c => !hasField(c, MC_ID_FIELD)).length
    },
    byAttribution: {
      adAttributed: validLeads.filter(c => hasField(c, AD_ID_FIELD)).length,
      notAttributed: validLeads.filter(c => !hasField(c, AD_ID_FIELD)).length
    },
    matrix: {
      manychat_attributed: validLeads.filter(c => hasField(c, MC_ID_FIELD) && hasField(c, AD_ID_FIELD)).length,
      manychat_not_attributed: validLeads.filter(c => hasField(c, MC_ID_FIELD) && !hasField(c, AD_ID_FIELD)).length,
      other_attributed: validLeads.filter(c => !hasField(c, MC_ID_FIELD) && hasField(c, AD_ID_FIELD)).length,
      other_not_attributed: validLeads.filter(c => !hasField(c, MC_ID_FIELD) && !hasField(c, AD_ID_FIELD)).length
    }
  };

  return results;
}

/**
 * GHL: Count opportunities in a stage with date filter
 */
async function countInStage(pipelineId, stageId, startDate, endDate) {
  let total = 0;
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      location_id: GHL_LOCATION_ID,
      pipeline_id: pipelineId,
      pipeline_stage_id: stageId,
      status: 'all',
      date: startDate,
      endDate: endDate,
      limit: '100'
    });

    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
          Accept: 'application/json'
        }
      }
    );
    const data = await res.json();
    const opps = data.opportunities || [];
    total += opps.length;

    if (opps.length < 100) break;
    page++;
    if (page > 100) break;
  }
  return total;
}

/**
 * Get pipeline definitions
 */
async function getPipelines() {
  const res = await fetch(
    `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`,
    {
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: '2021-07-28',
        Accept: 'application/json'
      }
    }
  );
  const data = await res.json();
  return data.pipelines;
}

/**
 * Get meetings held
 */
async function getMeetings(dateRange) {
  const pipelines = await getPipelines();

  // Calendly Pipeline
  const calendlyPipeline = pipelines.find(p => p.id === CALENDLY_PIPELINE_ID);
  let calendlyTotal = 0;
  const calendlyBreakdown = [];

  if (calendlyPipeline) {
    for (const stage of calendlyPipeline.stages) {
      if (!CALENDLY_EXCLUDE_STAGES.includes(stage.name)) {
        const count = await countInStage(
          CALENDLY_PIPELINE_ID,
          stage.id,
          dateRange.startGHL,
          dateRange.endGHL
        );
        if (count > 0) {
          calendlyBreakdown.push({ stage: stage.name, count });
        }
        calendlyTotal += count;
      }
    }
  }

  // Jane Pipeline
  const janePipeline = pipelines.find(p => p.id === JANE_PIPELINE_ID);
  let janeTotal = 0;

  if (janePipeline) {
    const completedDCStage = janePipeline.stages.find(s => s.name === 'Completed DC');
    if (completedDCStage) {
      janeTotal = await countInStage(
        JANE_PIPELINE_ID,
        completedDCStage.id,
        dateRange.startGHL,
        dateRange.endGHL
      );
    }
  }

  return {
    calendly: { total: calendlyTotal, breakdown: calendlyBreakdown },
    jane: { total: janeTotal },
    total: calendlyTotal + janeTotal
  };
}

async function main() {
  const arg = process.argv.slice(2).join(' ') || 'last 7 days';
  const dateRange = parseDateArg(arg);

  console.log(`\n## PPCU Stats - ${dateRange.display}\n`);

  // Get leads from GHL
  console.log('### New Leads (from GHL)\n');
  process.stdout.write('Fetching contacts');
  const contacts = await getAllContacts(dateRange.startISO, dateRange.endISO);
  console.log(' done!\n');
  const leads = analyzeLeads(contacts);

  console.log(`**Raw GHL Contacts:** ${contacts.length}`);
  console.log(`**Valid Leads (with email/phone):** ${leads.total}\n`);

  console.log('**By Source:**');
  console.log(`| Source | Count |`);
  console.log(`|--------|-------|`);
  console.log(`| ManyChat | ${leads.bySource.manychat} |`);
  console.log(`| Other | ${leads.bySource.other} |`);
  console.log('');

  console.log('**By Attribution:**');
  console.log(`| Attribution | Count |`);
  console.log(`|-------------|-------|`);
  console.log(`| Ad Attributed | ${leads.byAttribution.adAttributed} |`);
  console.log(`| Not Attributed | ${leads.byAttribution.notAttributed} |`);
  console.log('');

  console.log('**Matrix (Source x Attribution):**');
  console.log(`| | Ad Attributed | Not Attributed |`);
  console.log(`|----------|---------------|----------------|`);
  console.log(`| ManyChat | ${leads.matrix.manychat_attributed} | ${leads.matrix.manychat_not_attributed} |`);
  console.log(`| Other | ${leads.matrix.other_attributed} | ${leads.matrix.other_not_attributed} |`);

  console.log('\n---\n');

  // Get meetings
  console.log('### Meetings Held\n');
  const meetings = await getMeetings(dateRange);

  console.log(`**Calendly Free:** ${meetings.calendly.total}`);
  if (meetings.calendly.breakdown.length > 0) {
    for (const item of meetings.calendly.breakdown) {
      console.log(`  - ${item.stage}: ${item.count}`);
    }
  }
  console.log('');

  console.log(`**Jane Paid:** ${meetings.jane.total}`);
  console.log('');

  console.log(`**Total Meetings Held:** ${meetings.total}`);
}

main().catch(console.error);

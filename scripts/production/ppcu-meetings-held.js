#!/usr/bin/env node
/**
 * PPCU Meetings Held Query
 *
 * Counts meetings held across both pipelines:
 * - Calendly Free: All stages except "DC BOOKED" and "NO SHOW"
 * - Jane Paid: "Completed DC" stage only
 *
 * Usage:
 *   node scripts/production/ppcu-meetings-held.js "last 7 days"
 *   node scripts/production/ppcu-meetings-held.js "last 30 days"
 *   node scripts/production/ppcu-meetings-held.js "november 2025"
 *   node scripts/production/ppcu-meetings-held.js "december 2025"
 */

const locationId = 'ep0g6pacgWxOebjWoJUE';
const apiKey = 'pit-96165432-f9cd-4ec4-9395-7826a0ee0dc5';

// Pipeline configuration
const CALENDLY_PIPELINE_ID = 'sA2y4qH24zyLlLo8YucW';
const JANE_PIPELINE_ID = 'ElSWHXWlapgoSelwKHWP';
const CALENDLY_EXCLUDE_STAGES = ['DC BOOKED', 'NO SHOW'];

/**
 * Parse date argument into start/end dates (mm-dd-yyyy format)
 */
function parseDateArg(arg) {
  const today = new Date();
  const formatDate = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
  };

  const formatDisplay = (d) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  arg = arg.toLowerCase().trim();

  // "last N days"
  const lastDaysMatch = arg.match(/last\s+(\d+)\s+days?/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[1]);
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    return {
      start: formatDate(start),
      end: formatDate(today),
      display: `Last ${days} Days (${formatDisplay(start)} - ${formatDisplay(today)})`
    };
  }

  // "month year" (e.g., "november 2025")
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
      const end = new Date(year, monthNum + 1, 0); // Last day of month
      return {
        start: formatDate(start),
        end: formatDate(end),
        display: `${monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1)} ${year}`
      };
    }
  }

  // Default: last 7 days
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  return {
    start: formatDate(start),
    end: formatDate(today),
    display: `Last 7 Days (${formatDisplay(start)} - ${formatDisplay(today)})`
  };
}

/**
 * Count opportunities in a stage with date filter
 */
async function countInStage(pipelineId, stageId, startDate, endDate) {
  let total = 0;
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      location_id: locationId,
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
          Authorization: `Bearer ${apiKey}`,
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
 * Get pipeline stages
 */
async function getPipelines() {
  const res = await fetch(
    `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: '2021-07-28',
        Accept: 'application/json'
      }
    }
  );
  const data = await res.json();
  return data.pipelines;
}

async function main() {
  const arg = process.argv.slice(2).join(' ') || 'last 7 days';
  const dateRange = parseDateArg(arg);

  console.log(`\n## PPCU Meetings Held - ${dateRange.display}\n`);

  const pipelines = await getPipelines();

  // Calendly Pipeline
  const calendlyPipeline = pipelines.find(p => p.id === CALENDLY_PIPELINE_ID);
  if (!calendlyPipeline) {
    console.error('Calendly pipeline not found');
    return;
  }

  console.log('### Calendly Free (FREE DISCOVERY CALL PIPELINE)');
  console.log('| Stage | Count |');
  console.log('|-------|-------|');

  let calendlyTotal = 0;
  for (const stage of calendlyPipeline.stages) {
    if (!CALENDLY_EXCLUDE_STAGES.includes(stage.name)) {
      const count = await countInStage(
        CALENDLY_PIPELINE_ID,
        stage.id,
        dateRange.start,
        dateRange.end
      );
      if (count > 0) {
        console.log(`| ${stage.name} | ${count} |`);
      }
      calendlyTotal += count;
    }
  }
  console.log(`\n**Subtotal:** ${calendlyTotal}\n`);

  // Jane Pipeline
  const janePipeline = pipelines.find(p => p.id === JANE_PIPELINE_ID);
  if (!janePipeline) {
    console.error('Jane pipeline not found');
    return;
  }

  const completedDCStage = janePipeline.stages.find(s => s.name === 'Completed DC');
  if (!completedDCStage) {
    console.error('Completed DC stage not found');
    return;
  }

  console.log('### Jane Paid (Discovery Call Main Pipeline)');
  const janeCount = await countInStage(
    JANE_PIPELINE_ID,
    completedDCStage.id,
    dateRange.start,
    dateRange.end
  );
  console.log(`**Completed DC:** ${janeCount}\n`);

  // Total
  const total = calendlyTotal + janeCount;
  console.log('---');
  console.log(`**Total Meetings Held:** ${total}`);
}

main().catch(console.error);

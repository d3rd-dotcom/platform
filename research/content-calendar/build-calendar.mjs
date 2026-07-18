import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const projectRoot = process.cwd();
const inputPath = path.join(projectRoot, 'research/content-calendar/10-calendar-draft.json');
const outputDir = path.join(projectRoot, 'outputs/019f72b4-a252-7261-96f4-014339a8197f');
const previewDir = path.join(outputDir, 'previews');
const outputPath = path.join(outputDir, 'MWA_30_Day_Content_Calendar.xlsx');
const data = JSON.parse(await fs.readFile(inputPath, 'utf8'));

const COLORS = {
  academyBlue: '#5168FF',
  actionBlue: '#465BE0',
  blackpill: '#1A1B24',
  canvas: '#F6F8FE',
  indigo: '#50599B',
  violet: '#7A56C6',
  paleBlue: '#E9EDFF',
  paleViolet: '#F0EAFE',
  paleGreen: '#E8F6EF',
  paleYellow: '#FFF5D6',
  paleRed: '#FDEBEC',
  border: '#D7DDF2',
  muted: '#5F6475',
  white: '#FFFFFF'
};

const workbook = Workbook.create();
const strategy = workbook.worksheets.add('Strategy');
const calendar = workbook.worksheets.add('30-Day Calendar');
const channels = workbook.worksheets.add('Channel Playbook');
const measurement = workbook.worksheets.add('Measurement');
const preflight = workbook.worksheets.add('Preflight');
const sources = workbook.worksheets.add('Sources & Guardrails');

function titleBand(sheet, range, title, subtitle) {
  sheet.getRange(range).merge();
  const topLeft = range.split(':')[0];
  sheet.getRange(topLeft).values = [[title]];
  sheet.getRange(range).format = {
    fill: COLORS.blackpill,
    font: { bold: true, color: COLORS.white, size: 18 },
    verticalAlignment: 'center',
    horizontalAlignment: 'left'
  };
  sheet.getRange(range).format.rowHeight = 34;
  const [start, end] = range.split(':');
  const subtitleRow = Number(start.match(/\d+/)[0]) + 1;
  const startCol = start.match(/[A-Z]+/)[0];
  const endCol = end.match(/[A-Z]+/)[0];
  const subtitleRange = `${startCol}${subtitleRow}:${endCol}${subtitleRow}`;
  sheet.getRange(subtitleRange).merge();
  sheet.getRange(`${startCol}${subtitleRow}`).values = [[subtitle]];
  sheet.getRange(subtitleRange).format = {
    fill: COLORS.paleBlue,
    font: { color: COLORS.blackpill, size: 10 },
    verticalAlignment: 'center',
    wrapText: true
  };
  sheet.getRange(subtitleRange).format.rowHeight = 30;
}

function styleHeader(range) {
  range.format = {
    fill: COLORS.academyBlue,
    font: { bold: true, color: COLORS.white, size: 10 },
    verticalAlignment: 'center',
    horizontalAlignment: 'left',
    wrapText: true,
    borders: { preset: 'insideHorizontal', style: 'thin', color: COLORS.border }
  };
  range.format.rowHeight = 34;
}

function styleBody(range) {
  range.format = {
    fill: COLORS.white,
    font: { color: COLORS.blackpill, size: 9 },
    verticalAlignment: 'top',
    horizontalAlignment: 'left',
    wrapText: true,
    borders: {
      insideHorizontal: { style: 'thin', color: COLORS.border },
      bottom: { style: 'thin', color: COLORS.border }
    }
  };
}

function setColumnWidths(sheet, widths, startRow, endRow) {
  for (const [col, width] of Object.entries(widths)) {
    sheet.getRange(`${col}${startRow}:${col}${endRow}`).format.columnWidth = width;
  }
}

function excelDate(iso) {
  return new Date(`${iso}T12:00:00-04:00`);
}

// Strategy
strategy.showGridLines = false;
titleBand(
  strategy,
  'A1:H1',
  'Thirty Days of Fieldwork with Blue',
  `${data.campaign.start_date} to ${data.campaign.end_date} · ${data.campaign.timezone} · Built for a solo-founder publishing and learning loop`
);
strategy.getRange('A4:B10').values = [
  ['Campaign field', 'Decision'],
  ['Core definition', data.campaign.core_definition],
  ['Primary audience', data.campaign.primary_audience],
  ['Blue Radio position', data.campaign.blue_radio_position],
  ['Primary goal', data.campaign.primary_goal],
  ['Operating rule', data.campaign.operating_rule],
  ['Primary value event', data.campaign.measurement.primary_value_event]
];
styleHeader(strategy.getRange('A4:B4'));
styleBody(strategy.getRange('A5:B10'));
strategy.getRange('A5:A10').format.font = { bold: true, color: COLORS.indigo, size: 9 };
strategy.getRange('A5:B10').format.rowHeight = 44;

strategy.getRange('D4:E9').values = [
  ['Content mix', 'Planned'],
  ['Product proof', null],
  ['Academic', null],
  ['Participant', null],
  ['Community ritual', null],
  ['Build note', null]
];
styleHeader(strategy.getRange('D4:E4'));
styleBody(strategy.getRange('D5:E9'));
for (let row = 5; row <= 9; row += 1) {
  strategy.getRange(`E${row}`).formulas = [[`=COUNTIF('30-Day Calendar'!$D$6:$D$35,D${row})`]];
}
strategy.getRange('E5:E9').format.numberFormat = '0';
strategy.getRange('D5:D9').format.font = { bold: true, color: COLORS.indigo, size: 9 };

strategy.getRange('D11:H16').values = [
  ['Weekly micro-launch loop', 'Founder action', 'Content action', 'Audience action', 'Decision'],
  ['Observe', 'Watch or speak with target learners', 'Log exact questions and friction', 'Describe one goal or obstacle', 'Choose the question worth answering'],
  ['Teach', 'Verify one useful idea', 'Publish a sourced explanation', 'Save, question, or try the idea', 'Keep only topics that create useful response'],
  ['Demonstrate', 'Record a real product route', 'Show one complete learner job', 'Complete the same bounded action', 'Fix any break in the route'],
  ['Invite', 'Enter one aligned community carefully', 'Post native value plus one request', 'Give focused feedback', 'Return only with a meaningful update'],
  ['Improve', 'Ship the smallest useful change', 'Show what changed and why', 'Retry the route', 'Relaunch the improvement']
];
styleHeader(strategy.getRange('D11:H11'));
styleBody(strategy.getRange('D12:H16'));
strategy.getRange('D12:D16').format.font = { bold: true, color: COLORS.indigo, size: 9 };
strategy.getRange('D12:H16').format.rowHeight = 50;

strategy.getRange('A13:B18').values = [
  ['Publication gates', 'Rule'],
  ['Go', 'The post teaches, demonstrates, documents, or asks one precise research question.'],
  ['Hold', 'A capability, number, testimonial, participant story, reward, price, deadline, or privacy claim lacks current proof.'],
  ['Blue Radio', 'Describe the current episode as prerecorded, synchronized, character-led, and roughly five minutes.'],
  ['Sensitive topics', 'Keep education separate from diagnosis, treatment, crisis response, and promises of mental-health outcomes.'],
  ['Rewards', 'State the work and review standard before credits or a funded cash bounty. Keep infrastructure backstage.']
];
styleHeader(strategy.getRange('A13:B13'));
styleBody(strategy.getRange('A14:B18'));
strategy.getRange('A14:A18').format.font = { bold: true, color: COLORS.indigo, size: 9 };
strategy.getRange('A14:B18').format.rowHeight = 48;
setColumnWidths(strategy, { A: 22, B: 74, C: 3, D: 23, E: 24, F: 26, G: 26, H: 28 }, 1, 18);
strategy.freezePanes.freezeRows(3);

// Calendar
calendar.showGridLines = false;
titleBand(
  calendar,
  'A1:S1',
  '30-Day Editorial Calendar',
  'Dates are fixed. Posting windows are test slots, not industry benchmarks. Status, owner, result, and notes are editable operating fields.'
);
calendar.getRange('A4:S4').merge();
calendar.getRange('A4').values = [[
  'Positioning boundary: Blue Radio is an ambient platform field guide. Hold claims about live tutoring, personalization, real-time interaction, unique 24-hour programming, or learning outcomes.'
]];
calendar.getRange('A4:S4').format = {
  fill: COLORS.paleYellow,
  font: { bold: true, color: COLORS.blackpill, size: 10 },
  wrapText: true,
  verticalAlignment: 'center'
};
calendar.getRange('A4:S4').format.rowHeight = 34;

const calendarHeaders = [
  'Day', 'Date', 'Phase', 'Type', 'Objective', 'Primary Channel', 'Format', 'Hook', 'Caption Draft',
  'Visual Direction', 'Call to Action', 'Proof / Source', 'Guardrail / Hold Condition', 'Repurpose', 'Primary KPI',
  'Status', 'Owner', 'Result / Link', 'Notes'
];
calendar.getRange('A5:S5').values = [calendarHeaders];
styleHeader(calendar.getRange('A5:S5'));
const calendarRows = data.posts.map((post) => [
  post.day,
  excelDate(post.date),
  post.phase,
  post.type,
  post.objective,
  post.primary_channel,
  post.format,
  post.hook,
  post.caption,
  post.visual_direction,
  post.cta,
  post.proof_or_source,
  post.guardrail,
  post.repurpose,
  post.kpi,
  'Planned',
  '',
  '',
  ''
]);
calendar.getRange('A6:S35').values = calendarRows;
styleBody(calendar.getRange('A6:S35'));
calendar.getRange('A6:S35').format.rowHeight = 88;
calendar.getRange('A6:A35').format.horizontalAlignment = 'center';
calendar.getRange('B6:B35').format.numberFormat = 'yyyy-mm-dd';
calendar.getRange('B6:B35').format.horizontalAlignment = 'center';
calendar.getRange('D6:D35').format.font = { bold: true, color: COLORS.indigo, size: 9 };
calendar.getRange('H6:H35').format.font = { bold: true, color: COLORS.blackpill, size: 10 };
calendar.getRange('P6:S35').format.fill = COLORS.paleYellow;
calendar.getRange('P6:P35').dataValidation = {
  rule: { type: 'list', values: ['Planned', 'Drafting', 'Review', 'Scheduled', 'Published', 'Held'] }
};
calendar.getRange('D6:D35').conditionalFormats.add('containsText', { text: 'Product proof', format: { fill: COLORS.paleBlue } });
calendar.getRange('D6:D35').conditionalFormats.add('containsText', { text: 'Academic', format: { fill: COLORS.paleViolet } });
calendar.getRange('D6:D35').conditionalFormats.add('containsText', { text: 'Participant', format: { fill: COLORS.paleGreen } });
calendar.getRange('D6:D35').conditionalFormats.add('containsText', { text: 'Build note', format: { fill: COLORS.paleYellow } });
calendar.getRange('P6:P35').conditionalFormats.add('containsText', { text: 'Published', format: { fill: COLORS.paleGreen, font: { bold: true, color: COLORS.blackpill } } });
calendar.getRange('P6:P35').conditionalFormats.add('containsText', { text: 'Held', format: { fill: COLORS.paleRed, font: { bold: true, color: COLORS.blackpill } } });
const calendarTable = calendar.tables.add('A5:S35', true, 'CalendarTable');
calendarTable.showFilterButton = true;
calendarTable.showBandedRows = false;
setColumnWidths(calendar, {
  A: 6, B: 12, C: 25, D: 18, E: 30, F: 28, G: 25, H: 38, I: 62, J: 44,
  K: 34, L: 48, M: 52, N: 40, O: 30, P: 14, Q: 16, R: 26, S: 32
}, 1, 35);
calendar.freezePanes.freezeRows(5);
calendar.freezePanes.freezeColumns(2);

// Channel playbook
channels.showGridLines = false;
titleBand(
  channels,
  'A1:G1',
  'Channel Playbook',
  'One anchor asset can travel across surfaces, but every version should match the native context and lead to one product action.'
);
const channelRows = [
  ['Channel', 'Role', 'Best Anchor Format', 'Primary Job', 'Default CTA', 'Primary KPI', 'Operating Note'],
  ['YouTube', data.campaign.channel_roles.YouTube, '2–5 minute explanation or walkthrough', 'Depth, search, replay, and product demonstration', 'Open the matching guide, mission, or Blue Radio chapter', 'Meaningful actions from video', 'Publish one searchable explanation each week; derive Shorts from it.'],
  ['TikTok', data.campaign.channel_roles['TikTok and Instagram Reels'], '20–45 second concept-first clip', 'Discovery and question formation', 'Continue the same task in the Academy', 'Qualified visits and saves', 'Lead with the intellectual problem, then show Blue or the product action.'],
  ['Instagram Reels', data.campaign.channel_roles['TikTok and Instagram Reels'], '20–45 second captioned clip', 'Discovery and familiar character presence', 'Save, reply, or open the matching action', 'Saves and meaningful actions', 'Use clear captions and visual proof within the first seconds.'],
  ['Instagram Carousel', data.campaign.channel_roles['Instagram carousel'], 'Five-to-seven card source or product map', 'Save value and research credibility', 'Save the test or open the full source', 'Saves and source clicks', 'Put population, year, method, and limitation on the card.'],
  ['Reddit / Communities', data.campaign.channel_roles['Reddit and aligned communities'], 'Native useful post with one focused request', 'Research, discussion, and early learner recruitment', 'Answer one question or test one route', 'Substantive replies and interviews', 'Learn each community’s rules and participate before posting.'],
  ['Discord', data.campaign.channel_roles.Discord, 'Prompt, field check, or consented artifact', 'Existing-member learning loop', 'Complete one action or review one artifact', 'Completions and useful feedback', 'Keep participant work permissioned and avoid public pressure.'],
  ['Blue Radio', data.campaign.channel_roles['Blue Radio'], 'Prerecorded synchronized chapter', 'Ambient orientation and recurring host presence', 'Open the feature named in the chapter', 'Tune-in-to-action conversion', 'Current episode is 4:46 and prerecorded. Treat stronger broadcast claims as roadmap.'],
  ['Founder Account', data.campaign.channel_roles['Founder account'], 'Correction log or what-changed note', 'Trust, product learning, and accountable building', 'Inspect the source or retry the route', 'Qualified questions and retries', 'Publish real changes and limitations. Skip filler updates.']
];
channels.getRange('A4:G12').values = channelRows;
styleHeader(channels.getRange('A4:G4'));
styleBody(channels.getRange('A5:G12'));
channels.getRange('A5:A12').format.font = { bold: true, color: COLORS.indigo, size: 9 };
channels.getRange('A5:G12').format.rowHeight = 64;
setColumnWidths(channels, { A: 20, B: 44, C: 34, D: 35, E: 35, F: 27, G: 45 }, 1, 12);
channels.freezePanes.freezeRows(4);

// Measurement
measurement.showGridLines = false;
titleBand(
  measurement,
  'A1:P1',
  'Measurement Tracker',
  'Yellow cells are inputs. Action rate and return rate are formulas. Define every metric before comparing posts.'
);
const measurementHeaders = [
  'Day', 'Date', 'Content Type', 'Primary Channel', 'Status', 'Views', 'Qualified Visits',
  'Meaningful Actions', 'Action Rate', '7-Day Returns', 'Return Rate', 'Saves',
  'Substantive Replies', 'Blue Radio Tune-Ins', 'Source Clicks', 'Notes'
];
measurement.getRange('A5:P5').values = [measurementHeaders];
styleHeader(measurement.getRange('A5:P5'));
for (let i = 0; i < data.posts.length; i += 1) {
  const row = 6 + i;
  const post = data.posts[i];
  measurement.getRange(`A${row}:D${row}`).values = [[post.day, excelDate(post.date), post.type, post.primary_channel]];
  measurement.getRange(`E${row}`).formulas = [[`='30-Day Calendar'!P${row}`]];
  measurement.getRange(`F${row}:H${row}`).values = [['', '', '']];
  measurement.getRange(`I${row}`).formulas = [[`=IFERROR(H${row}/G${row},0)`]];
  measurement.getRange(`J${row}`).values = [['']];
  measurement.getRange(`K${row}`).formulas = [[`=IFERROR(J${row}/H${row},0)`]];
  measurement.getRange(`L${row}:P${row}`).values = [['', '', '', '', '']];
}
styleBody(measurement.getRange('A6:P35'));
measurement.getRange('A6:P35').format.rowHeight = 34;
measurement.getRange('B6:B35').format.numberFormat = 'yyyy-mm-dd';
measurement.getRange('I6:I35').format.numberFormat = '0.0%';
measurement.getRange('K6:K35').format.numberFormat = '0.0%';
measurement.getRange('F6:H35').format.fill = COLORS.paleYellow;
measurement.getRange('J6:J35').format.fill = COLORS.paleYellow;
measurement.getRange('L6:P35').format.fill = COLORS.paleYellow;
measurement.getRange('I6:I35').conditionalFormats.add('colorScale', { colors: [COLORS.paleRed, COLORS.paleYellow, COLORS.paleGreen], thresholds: ['min', '50%', 'max'] });
measurement.getRange('K6:K35').conditionalFormats.add('colorScale', { colors: [COLORS.paleRed, COLORS.paleYellow, COLORS.paleGreen], thresholds: ['min', '50%', 'max'] });
const measurementTable = measurement.tables.add('A5:P35', true, 'MeasurementTable');
measurementTable.showFilterButton = true;
measurementTable.showBandedRows = false;
setColumnWidths(measurement, {
  A: 6, B: 12, C: 18, D: 30, E: 14, F: 12, G: 17, H: 18, I: 14,
  J: 16, K: 14, L: 12, M: 20, N: 20, O: 14, P: 34
}, 1, 35);
measurement.freezePanes.freezeRows(5);
measurement.freezePanes.freezeColumns(2);

// Preflight
preflight.showGridLines = false;
titleBand(
  preflight,
  'A1:J1',
  'Publication Preflight',
  'A date never clears a hold. Mark each required check before scheduling; use an evergreen replacement when a row cannot clear safely.'
);
const preflightHeaders = [
  'Day', 'Date', 'Source Opened', 'Product Route Tested', 'Consent Stored', 'Disclosure Added',
  'Metric Instrumented', 'Hold Cleared', 'Fallback Ready', 'Reviewer Notes'
];
preflight.getRange('A5:J5').values = [preflightHeaders];
styleHeader(preflight.getRange('A5:J5'));
const preflightRows = data.posts.map((post) => [
  post.day,
  excelDate(post.date),
  'No',
  'No',
  post.type === 'Participant' ? 'No' : 'N/A',
  'No',
  'No',
  'No',
  'No',
  post.guardrail
]);
preflight.getRange('A6:J35').values = preflightRows;
styleBody(preflight.getRange('A6:J35'));
preflight.getRange('A6:J35').format.rowHeight = 58;
preflight.getRange('B6:B35').format.numberFormat = 'yyyy-mm-dd';
preflight.getRange('C6:I35').format.fill = COLORS.paleYellow;
preflight.getRange('C6:I35').dataValidation = {
  rule: { type: 'list', values: ['No', 'Yes', 'N/A'] }
};
preflight.getRange('C6:I35').conditionalFormats.add('containsText', { text: 'Yes', format: { fill: COLORS.paleGreen, font: { bold: true, color: COLORS.blackpill } } });
preflight.getRange('C6:I35').conditionalFormats.add('containsText', { text: 'No', format: { fill: COLORS.paleRed, font: { bold: true, color: COLORS.blackpill } } });
const preflightTable = preflight.tables.add('A5:J35', true, 'PreflightTable');
preflightTable.showFilterButton = true;
preflightTable.showBandedRows = false;
setColumnWidths(preflight, { A: 6, B: 12, C: 17, D: 20, E: 17, F: 18, G: 20, H: 16, I: 16, J: 62 }, 1, 35);
preflight.freezePanes.freezeRows(5);
preflight.freezePanes.freezeColumns(2);

// Sources and guardrails
sources.showGridLines = false;
titleBand(
  sources,
  'A1:H1',
  'Sources and Publication Guardrails',
  'External claims keep their population, date, method, and limitation. Local product claims keep their current implementation boundary.'
);
const sourceRows = [
  ['ID', 'Category', 'Source', 'Publisher / Date', 'Use in Calendar', 'Direct URL or Local Path', 'Evidence Type', 'Publication Caveat'],
  ['S01', 'Startup marketing', 'YC’s Essential Startup Advice', 'Y Combinator · 2017-09-25', 'Launch useful work, talk to users, iterate before scale', 'https://www.ycombinator.com/blog/ycs-essential-startup-advice/', 'First-party advice', 'Treat as operating advice, not a performance benchmark.'],
  ['S02', 'Startup marketing', 'Startup School Week 4 recap', 'Y Combinator · 2019-09-25', 'Continuous launches, community participation, retention', 'https://www.ycombinator.com/blog/startup-school-week-4-recap-kat-manalac-and-gustaf-alstromer/', 'First-party recap', 'MWA’s four-week loop is an inference.'],
  ['S03', 'Campaign design', 'Bringing Dark Patterns to Light', 'Federal Trade Commission · 2022-09', 'False countdown and scarcity lesson', 'https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf', 'U.S. staff report', 'Guidance is not a complete legal analysis.'],
  ['S04', 'Education access', 'PIAAC 2017 National Results', 'NCES · 2017 results', 'Correct adult-literacy proficiency statistic', 'https://nces.ed.gov/surveys/piaac/2017/national_results.asp', 'U.S. national assessment', 'Use Level 1 or below; do not convert to a grade level.'],
  ['S05', 'Audience', 'Social Media Fact Sheet', 'Pew Research Center · 2025-11-20', '18–29 platform reach', 'https://www.pewresearch.org/internet/fact-sheet/social-media/', 'Probability-based U.S. survey', 'Ever-use estimates for ages 18–29 are not attention or conversion.'],
  ['S06', 'Audience', '2025 Digital Media Trends', 'Deloitte · 2025-03-25', 'Creator-led social video discovery hypothesis', 'https://www.deloitte.com/us/en/insights/industry/technology/digital-media-trends-consumption-habits-survey/2025.html', 'Weighted online U.S. survey', 'Gen Z definition includes minors and adults older than 25.'],
  ['S07', 'Audio', '13–34 Year-Olds are Turning Up the Audio Dial', 'Edison Research · 2026-05-06', 'Audio as habitual/background media', 'https://www.edisonresearch.com/13-34-year-olds-are-turning-up-the-audio-dial/', 'Share of Ear dataset', 'Age band includes minors and adults through 34; subgroup sample not public.'],
  ['S08', 'Virtual creators', 'The Virtual Evolution of the Creator', 'YouTube · 2025', 'Directional virtual-creator reach', 'https://services.google.com/fh/files/misc/youtubereport-vtubers.pdf', 'Platform report', 'Survey methodology and wide 14–44 band limit prevalence claims.'],
  ['S09', 'VTuber viewing', 'Why does Gen Z watch virtual streaming VTube anime videos with avatars on Twitch?', 'Li · 2023-09-13', 'Viewing motivations and task usefulness', 'https://doi.org/10.1515/omgc-2023-0030', 'Peer-reviewed convenience sample', 'Existing viewers from Reddit; nationality not collected.'],
  ['S10', 'Learning format', 'Text versus video tutorial experiment', 'Käfer, Kulesz, Wagner · 2017-04-01', 'Video for orientation plus text for lookup hypothesis', 'https://doi.org/10.22152/programming-journal.org/2017/1/17', 'Experiment, n=42', 'Software-engineering students; narrow context.'],
  ['S11', 'Online learning', 'Young Adults Increasingly Choose Online Education', 'Champlain College Online · 2025-05-13', 'Three depth/time options', 'https://online.champlain.edu/blog/young-adults-choosing-online-education-flexibility-affordability', 'Publisher survey, n=2,032', 'Selected college-oriented sample and incomplete public methodology.'],
  ['S12', 'Privacy', 'FTC BetterHelp final order', 'Federal Trade Commission · 2023-07-14', 'Keep sensitive reflections out of advertising audiences', 'https://www.ftc.gov/news-events/news/press-releases/2023/07/ftc-gives-final-approval-order-banning-betterhelp-sharing-sensitive-health-data-advertising', 'Regulatory order', 'Use for privacy design, not as evidence about therapy outcomes.'],
  ['S13', 'Product', 'Blue Radio implementation', 'Mental Wealth Academy · reviewed 2026-07-17', 'Synchronized prerecorded orientation broadcast', '/Users/james/MentalWealthAcademy/components/blue-scene/BlueRadio.tsx', 'Repository evidence', 'Current manifest is 285.93 seconds and has no live interaction.'],
  ['S14', 'Product', 'Blue Radio manifest', 'Mental Wealth Academy · generated 2026-07-17', 'Ten chapter titles and runtime', '/Users/james/MentalWealthAcademy/lib/blue-radio-manifest.json', 'Repository evidence', 'Do not imply unique day-and-night programming.'],
  ['S15', 'Product', 'Guides recommendation route', 'Mental Wealth Academy · reviewed 2026-07-17', 'Next unlocked guide options from recorded completions', '/Users/james/MentalWealthAcademy/app/api/guides/recommend/route.ts', 'Repository evidence', 'Does not infer a curriculum from field-note meaning.'],
  ['S16', 'Brand', 'Editorial Brand Book v4.0', 'Mental Wealth Academy · 2026-07-10', 'Voice, audience, Blue role, technology-backstage rule', '/Users/james/MentalWealthAcademy/EDITORIAL.md', 'Canonical internal source', 'Current product and deployment still require verification.']
];
sources.getRange(`A4:H${3 + sourceRows.length}`).values = sourceRows;
styleHeader(sources.getRange('A4:H4'));
styleBody(sources.getRange(`A5:H${3 + sourceRows.length}`));
sources.getRange(`A5:H${3 + sourceRows.length}`).format.rowHeight = 58;
sources.getRange(`A5:A${3 + sourceRows.length}`).format.font = { bold: true, color: COLORS.indigo, size: 9 };
const sourcesTable = sources.tables.add(`A4:H${3 + sourceRows.length}`, true, 'SourcesTable');
sourcesTable.showFilterButton = true;
sourcesTable.showBandedRows = false;

const guardrailStart = 6 + sourceRows.length;
const guardrailRows = [
  ['Publication guardrail', 'Required action'],
  ['Technology stays backstage', 'Outward copy uses credits, real rewards, guides, missions, and member value. Remove chain names, tickers, wallet, token, NFT, and transaction language.'],
  ['Blue Radio boundary', 'Say prerecorded, synchronized, character-led, and roughly five minutes. Hold live tutor, interactive stream, personalization, or learning-efficacy claims.'],
  ['Participant proof', 'Require a real artifact, consent, attribution preference, privacy review, and typicality context before publication.'],
  ['Numbers', 'Record source, unit, population, window, as-of date, and limitation. Suppress tiny groups where privacy may be affected.'],
  ['Rewards', 'Publish the work, eligibility, rubric, reviewer, and operational status before credits or a cash bounty. Avoid value or earnings implications.'],
  ['Mental-health boundary', 'MWA provides education and structured reflection. Diagnosis, treatment, crisis response, and care belong with qualified services.'],
  ['Urgency', 'Use a deadline or capacity statement only when the exact constraint is real, owned, dated, and documented.'],
  ['Live-site drift', 'Verify deployed hero, CTA, price, proof totals, course access, and feature routes before reusing landing-page copy.']
];
sources.getRange(`A${guardrailStart}:B${guardrailStart + guardrailRows.length - 1}`).values = guardrailRows;
styleHeader(sources.getRange(`A${guardrailStart}:B${guardrailStart}`));
styleBody(sources.getRange(`A${guardrailStart + 1}:B${guardrailStart + guardrailRows.length - 1}`));
sources.getRange(`A${guardrailStart + 1}:A${guardrailStart + guardrailRows.length - 1}`).format.font = { bold: true, color: COLORS.indigo, size: 9 };
sources.getRange(`A${guardrailStart + 1}:B${guardrailStart + guardrailRows.length - 1}`).format.rowHeight = 48;
setColumnWidths(sources, { A: 21, B: 24, C: 42, D: 31, E: 42, F: 74, G: 28, H: 52 }, 1, guardrailStart + guardrailRows.length);
sources.freezePanes.freezeRows(4);

await fs.mkdir(previewDir, { recursive: true });

const inspections = [];
inspections.push((await workbook.inspect({ kind: 'table', range: 'Strategy!A1:H18', include: 'values,formulas', tableMaxRows: 20, tableMaxCols: 8, maxChars: 7000 })).ndjson);
inspections.push((await workbook.inspect({ kind: 'table', range: "'30-Day Calendar'!A1:S10", include: 'values,formulas', tableMaxRows: 10, tableMaxCols: 19, maxChars: 9000 })).ndjson);
inspections.push((await workbook.inspect({ kind: 'table', range: 'Measurement!A1:P12', include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 16, maxChars: 7000 })).ndjson);
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'final formula error scan'
});
inspections.push(errors.ndjson);
await fs.writeFile(path.join(outputDir, 'inspection.ndjson'), inspections.join('\n'));

const previewSpecs = [
  ['Strategy', 'A1:H18', 'strategy.png'],
  ['30-Day Calendar', 'A1:J14', 'calendar-left.png'],
  ['30-Day Calendar', 'K1:S14', 'calendar-right.png'],
  ['Channel Playbook', 'A1:G12', 'channels.png'],
  ['Measurement', 'A1:P14', 'measurement.png'],
  ['Preflight', 'A1:J14', 'preflight.png'],
  ['Sources & Guardrails', `A1:H${guardrailStart + guardrailRows.length - 1}`, 'sources.png']
];
for (const [sheetName, range, fileName] of previewSpecs) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);

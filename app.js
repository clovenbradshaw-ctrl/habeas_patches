/* ================================================================
   Amino Habeas - Plain HTML App (vanilla JS, no build step)
   Replaces React/Vite/TypeScript with plain JS + Matrix REST API
   ================================================================ */

// ── Configuration ────────────────────────────────────────────────
var CONFIG = {
  MATRIX_SERVER_URL: 'https://app.aminoimmigration.com',
  MATRIX_SERVER_NAME: 'aminoimmigration.com',
  ORG_ROOM_ALIAS: '#org:aminoimmigration.com',
  TEMPLATES_ROOM_ALIAS: '#templates:aminoimmigration.com',
  ALLOWED_REGISTRATION_DOMAINS: ['aminoimmigration.com', 'rklacylaw.com', 'aminointegration.com'],
};

// ── Utilities ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }
function ts(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch (e) { return iso; }
}
function timeAgo(iso) {
  try {
    var diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return 'just now';
    var s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60);
    if (m < 60) return m + (m === 1 ? ' min ago' : ' mins ago');
    var hr = Math.floor(m / 60);
    if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
    var d = Math.floor(hr / 24);
    if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    var w = Math.floor(d / 7);
    if (w < 5) return w + (w === 1 ? ' week ago' : ' weeks ago');
    var mo = Math.floor(d / 30);
    if (mo < 12) return mo + (mo === 1 ? ' month ago' : ' months ago');
    var y = Math.floor(d / 365);
    return y + (y === 1 ? ' year ago' : ' years ago');
  } catch (e) { return ''; }
}
function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function generateSecurePassword(length) {
  length = length || 16;
  var upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  var lower = 'abcdefghijkmnpqrstuvwxyz';
  var digits = '23456789';
  var symbols = '#$%&*+-=?@^_';
  var all = upper + lower + digits + symbols;
  var arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  var pw = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];
  for (var i = 4; i < length; i++) {
    pw.push(all[arr[i] % all.length]);
  }
  var shuffle = new Uint8Array(pw.length);
  crypto.getRandomValues(shuffle);
  for (var i = pw.length - 1; i > 0; i--) {
    var j = shuffle[i] % (i + 1);
    var tmp = pw[i]; pw[i] = pw[j]; pw[j] = tmp;
  }
  return pw.join('');
}

// ── Toast Notifications ─────────────────────────────────────────
function toast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  container.appendChild(el);
  el.offsetHeight; // force reflow before adding .show
  el.classList.add('show');
  var duration = type === 'error' ? 6000 : 3000;
  var timer = setTimeout(function() { dismissToast(el); }, duration);
  el.addEventListener('click', function() {
    clearTimeout(timer);
    dismissToast(el);
  });
}
function dismissToast(el) {
  if (!el || !el.parentNode) return;
  el.classList.remove('show');
  el.classList.add('hide');
  setTimeout(function() {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 300);
}

function countPetitionFieldUsage(fieldName) {
  var counts = {};
  var pets = Object.values(S.petitions);
  for (var i = 0; i < pets.length; i++) {
    var val = pets[i][fieldName];
    if (val) counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

function countAttorneyUsage() {
  var counts = {};
  var pets = Object.values(S.petitions);
  for (var i = 0; i < pets.length; i++) {
    if (pets[i]._att1Id) counts[pets[i]._att1Id] = (counts[pets[i]._att1Id] || 0) + 1;
    if (pets[i]._att2Id) counts[pets[i]._att2Id] = (counts[pets[i]._att2Id] || 0) + 1;
  }
  return counts;
}

function sortByFrequency(items, counts, displayFn) {
  return items.slice().sort(function(a, b) {
    var freqA = counts[a.id] || 0;
    var freqB = counts[b.id] || 0;
    if (freqB !== freqA) return freqB - freqA;
    return displayFn(a).localeCompare(displayFn(b));
  });
}

var STAGES = ['intake', 'drafting', 'review', 'filing', 'filed'];
var SM = {
  intake:   { color: '#b08d57', bg: '#faf5e4', label: 'Intake' },
  drafting: { color: '#c9a040', bg: '#fdf8eb', label: 'Drafting' },
  review:   { color: '#5a9e6f', bg: '#eaf5ee', label: 'Review' },
  filing:   { color: '#7a70c0', bg: '#eeeafa', label: 'Filing' },
  filed:    { color: '#4a7ab5', bg: '#e8f0fa', label: 'Filed' },
};

// Migrate old 3-stage names to new 5-stage names
function migrateStage(stage) {
  if (stage === 'drafted') return 'drafting';
  if (stage === 'reviewed') return 'review';
  if (stage === 'submitted') return 'filed';
  if (STAGES.indexOf(stage) >= 0) return stage;
  return 'intake';
}

// ── Enumeration Option Arrays ───────────────────────────────────
var US_STATES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',
  GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',
  IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',
  MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
  MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',
  SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',
  WY:'Wyoming',PR:'Puerto Rico',VI:'U.S. Virgin Islands',GU:'Guam',
  AS:'American Samoa',MP:'Northern Mariana Islands'
};
var US_STATE_NAMES = Object.values(US_STATES).sort();

var COUNTRIES = [
  'Mexico','Guatemala','Honduras','El Salvador','Colombia','Venezuela',
  'Ecuador','Brazil','Cuba','Haiti','Dominican Republic','Nicaragua',
  'Peru','India','China','Philippines',
  '---',
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad',
  'Chile','Comoros','Congo (Brazzaville)','Congo (DRC)','Costa Rica',
  "Cote d'Ivoire",'Croatia','Cyprus','Czech Republic','Denmark','Djibouti',
  'Dominica','East Timor','Egypt','Equatorial Guinea','Eritrea','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia',
  'Germany','Ghana','Greece','Grenada','Guinea','Guinea-Bissau','Guyana',
  'Hungary','Iceland','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait',
  'Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya',
  'Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia',
  'Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius',
  'Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique',
  'Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Niger',
  'Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau',
  'Palestine','Panama','Papua New Guinea','Paraguay','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
  'Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland',
  'Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Tonga',
  'Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Vietnam','Yemen','Zambia','Zimbabwe'
];

var ENTRY_METHOD_OPTIONS = [
  'without inspection',
  'with inspection at a port of entry',
  'with a valid visa that has since expired',
  'through the visa waiver program'
];

var CRIMINAL_HISTORY_OPTIONS = [
  'has no criminal record',
  'has a minor criminal record',
  'has a criminal record'
];

var COMMUNITY_TIES_OPTIONS = [
  'has strong family and community ties in the United States',
  'has family in the United States',
  'has community and employment ties in the United States'
];

var ICE_TITLE_OPTIONS = ['Director', 'Acting Director', 'Deputy Director'];

var ICE_FACILITY_SEEDS = [
  {n:'Adams County Correctional Center',c:'Natchez',s:'MS',fo:'New Orleans Field Office'},
  {n:'Adelanto ICE Processing Center',c:'Adelanto',s:'CA',fo:'Los Angeles Field Office'},
  {n:'Alamance County Detention Center',c:'Graham',s:'NC',fo:'Atlanta Field Office'},
  {n:'Allen Parish Public Safety Complex',c:'Oberlin',s:'LA',fo:'New Orleans Field Office'},
  {n:'Anchorage Correctional Complex',c:'Anchorage',s:'AK',fo:'Seattle Field Office'},
  {n:'Baker County Detention Center',c:'MacClenny',s:'FL',fo:'Miami Field Office'},
  {n:'Bluebonnet Detention Facility',c:'Anson',s:'TX',fo:'Dallas Field Office'},
  {n:'Boone County Jail',c:'Burlington',s:'KY',fo:'Chicago Field Office'},
  {n:'Broome County Correctional Facility',c:'Binghamton',s:'NY',fo:'Buffalo Field Office'},
  {n:'Broward Transitional Center',c:'Pompano Beach',s:'FL',fo:'Miami Field Office'},
  {n:'Buffalo (Batavia) Service Processing Center',c:'Batavia',s:'NY',fo:'Buffalo Field Office'},
  {n:'Burleigh County Detention Center',c:'Bismarck',s:'ND',fo:'St. Paul Field Office'},
  {n:'Butler County Sheriff\'s Office',c:'Hamilton',s:'OH',fo:'Detroit Field Office'},
  {n:'Calhoun County Correctional Center',c:'Battle Creek',s:'MI',fo:'Detroit Field Office'},
  {n:'California City Detention Facility',c:'California City',s:'CA',fo:'San Francisco Field Office'},
  {n:'Campbell County Detention Center',c:'Newport',s:'KY',fo:'Chicago Field Office'},
  {n:'Caroline Detention Facility',c:'Bowling Green',s:'VA',fo:'Washington Field Office'},
  {n:'Central Arizona Florence Correctional Center',c:'Florence',s:'AZ',fo:'Phoenix Field Office'},
  {n:'Central Louisiana ICE Processing Center',c:'Jena',s:'LA',fo:'New Orleans Field Office'},
  {n:'Chase County Jail',c:'Cottonwood Falls',s:'KS',fo:'Chicago Field Office'},
  {n:'Chippewa County Correctional Facility',c:'Sault Ste. Marie',s:'MI',fo:'Detroit Field Office'},
  {n:'Christian County Jail',c:'Hopkinsville',s:'KY',fo:'Chicago Field Office'},
  {n:'Cibola County Correctional Center',c:'Milan',s:'NM',fo:'El Paso Field Office'},
  {n:'Cimarron Correctional Facility',c:'Cushing',s:'OK',fo:'Dallas Field Office'},
  {n:'Clark County Jail',c:'Jeffersonville',s:'IN',fo:'Chicago Field Office'},
  {n:'Clay County Jail',c:'Brazil',s:'IN',fo:'Chicago Field Office'},
  {n:'Clinton County Correctional Facility',c:'McElhattan',s:'PA',fo:'Philadelphia Field Office'},
  {n:'Clinton County Jail',c:'Plattsburgh',s:'NY',fo:'Buffalo Field Office'},
  {n:'Clinton County Sheriff\'s Office',c:'Frankfort',s:'IN',fo:'Chicago Field Office'},
  {n:'CNMI Department of Corrections',c:'Susupe, Saipan',s:'MP',fo:'San Francisco Field Office'},
  {n:'Coastal Bend Detention Center',c:'Robstown',s:'TX',fo:'Harlingen Field Office'},
  {n:'CoreCivic Laredo Processing Center',c:'Laredo',s:'TX',fo:'Harlingen Field Office'},
  {n:'CoreCivic Webb County Detention Center',c:'Laredo',s:'TX',fo:'Harlingen Field Office'},
  {n:'Corrections Center of Northwest Ohio (CCNO)',c:'Stryker',s:'OH',fo:'Detroit Field Office'},
  {n:'Crow Wing County Jail',c:'Brainerd',s:'MN',fo:'St. Paul Field Office'},
  {n:'Cumberland County Jail',c:'Portland',s:'ME',fo:'Boston Field Office'},
  {n:'Daviess County Detention Center',c:'Owensboro',s:'KY',fo:'Chicago Field Office'},
  {n:'Delaney Hall Detention Facility',c:'Newark',s:'NJ',fo:'Newark Field Office'},
  {n:'Denver Contract Detention Facility (Aurora)',c:'Aurora',s:'CO',fo:'Denver Field Office'},
  {n:'Desert View Annex',c:'Adelanto',s:'CA',fo:'Los Angeles Field Office'},
  {n:'Diamondback Correctional Facility',c:'Watonga',s:'OK',fo:'Dallas Field Office'},
  {n:'Dilley Immigration Processing Center',c:'Dilley',s:'TX',fo:'San Antonio Field Office'},
  {n:'Dodge Detention Facility',c:'Juneau',s:'WI',fo:'Chicago Field Office'},
  {n:'East Hidalgo Detention Center',c:'La Villa',s:'TX',fo:'Harlingen Field Office'},
  {n:'Eden Detention Center',c:'Eden',s:'TX',fo:'Dallas Field Office'},
  {n:'El Paso Service Processing Center',c:'El Paso',s:'TX',fo:'El Paso Field Office'},
  {n:'El Valle Detention Facility',c:'Raymondville',s:'TX',fo:'Harlingen Field Office'},
  {n:'Elizabeth Contract Detention Facility',c:'Elizabeth',s:'NJ',fo:'Newark Field Office'},
  {n:'Elmore County Detention Center (Elmore County Jail)',c:'Mountain Home',s:'ID',fo:'Salt Lake City Field Office'},
  {n:'Eloy Detention Center',c:'Eloy',s:'AZ',fo:'Phoenix Field Office'},
  {n:'ERO El Paso Camp East Montana',c:'El Paso',s:'TX',fo:'El Paso Field Office'},
  {n:'Farmville Detention Center',c:'Farmville',s:'VA',fo:'Washington Field Office'},
  {n:'FCI Atlanta',c:'Atlanta',s:'GA',fo:'Atlanta Field Office'},
  {n:'FCI Leavenworth',c:'Leavenworth',s:'KS',fo:'Chicago Field Office'},
  {n:'FCI Lewisburg',c:'Lewisburg',s:'PA',fo:'Philadelphia Field Office'},
  {n:'FDC Miami',c:'Miami',s:'FL',fo:'Miami Field Office'},
  {n:'FDC Philadelphia',c:'Philadelphia',s:'PA',fo:'Philadelphia Field Office'},
  {n:'Federal Correctional Institution - Berlin, NH',c:'Berlin',s:'NH',fo:'Boston Field Office'},
  {n:'Federal Detention Center, Honolulu (FDC Honolulu)',c:'Honolulu',s:'HI',fo:'San Francisco Field Office'},
  {n:'Florence Service Processing Center',c:'Florence',s:'AZ',fo:'Phoenix Field Office'},
  {n:'Folkston D Ray ICE Processing Center',c:'Folkston',s:'GA',fo:'Atlanta Field Office'},
  {n:'Folkston ICE Processing Center (Annex)',c:'Folkston',s:'GA',fo:'Atlanta Field Office'},
  {n:'Folkston ICE Processing Center (Main)',c:'Folkston',s:'GA',fo:'Atlanta Field Office'},
  {n:'Freeborn County Jail Services',c:'Albert Lea',s:'MN',fo:'St. Paul Field Office'},
  {n:'Geauga County Safety Center',c:'Chardon',s:'OH',fo:'Detroit Field Office'},
  {n:'Glades County Detention Center',c:'Moore Haven',s:'FL',fo:'Miami Field Office'},
  {n:'Golden State Annex',c:'McFarland',s:'CA',fo:'San Francisco Field Office'},
  {n:'Grand Forks County Correctional Center',c:'Grand Forks',s:'ND',fo:'St. Paul Field Office'},
  {n:'Grayson County Detention Center',c:'Leachfield',s:'KY',fo:'Chicago Field Office'},
  {n:'Greene County Jail',c:'Springfield',s:'MO',fo:'Chicago Field Office'},
  {n:'Guam Department of Corrections, Hagatna Detention Facility',c:'Hagatna',s:'GU',fo:'San Francisco Field Office'},
  {n:'Henderson Detention Center',c:'Henderson',s:'NV',fo:'Salt Lake City Field Office'},
  {n:'Hopkins County Jail',c:'Madisonville',s:'KY',fo:'Chicago Field Office'},
  {n:'Houston Contract Detention Facility',c:'Houston',s:'TX',fo:'Houston Field Office'},
  {n:'IAH Polk Adult Detention Facility',c:'Livingston',s:'TX',fo:'Houston Field Office'},
  {n:'Imperial Regional Detention Facility',c:'Calexico',s:'CA',fo:'San Diego Field Office'},
  {n:'Irwin County Detention Center',c:'Ocilla',s:'GA',fo:'Atlanta Field Office'},
  {n:'Jackson Parish Correctional Center',c:'Jonesboro',s:'LA',fo:'New Orleans Field Office'},
  {n:'Joe Corley Processing Center',c:'Conroe',s:'TX',fo:'Houston Field Office'},
  {n:'Kandiyohi County Jail',c:'Willmar',s:'MN',fo:'St. Paul Field Office'},
  {n:'Karnes County Immigration Processing Center',c:'Karnes City',s:'TX',fo:'San Antonio Field Office'},
  {n:'Kay County Detention Center',c:'Newkirk',s:'OK',fo:'Chicago Field Office'},
  {n:'Kenton County Detention Center',c:'Covington',s:'KY',fo:'Chicago Field Office'},
  {n:'Krome North Service Processing Center',c:'Miami',s:'FL',fo:'Miami Field Office'},
  {n:'La Salle County Regional Detention Center',c:'Encinal',s:'TX',fo:'San Antonio Field Office'},
  {n:'Limestone County Detention Center',c:'Groesbeck',s:'TX',fo:'Houston Field Office'},
  {n:'Lincoln County Detention Center',c:'North Platte',s:'NE',fo:'St. Paul Field Office'},
  {n:'Louisiana ICE Processing Center',c:'Angola',s:'LA',fo:'New Orleans Field Office'},
  {n:'Mahoning County Justice Center',c:'Youngstown',s:'OH',fo:'Detroit Field Office'},
  {n:'McCook Detention Center',c:'McCook',s:'NE',fo:'St. Paul Field Office'},
  {n:'MDC Brooklyn',c:'Brooklyn',s:'NY',fo:'New York City Field Office'},
  {n:'Mesa Verde ICE Processing Center',c:'Bakersfield',s:'CA',fo:'San Francisco Field Office'},
  {n:'Miami Correctional Facility (MCF)',c:'Bunker Hill',s:'IN',fo:'Chicago Field Office'},
  {n:'Monroe County Jail',c:'Monroe',s:'MI',fo:'Detroit Field Office'},
  {n:'Montgomery Processing Center',c:'Conroe',s:'TX',fo:'Houston Field Office'},
  {n:'Moshannon Valley Processing Center',c:'Philipsburg',s:'PA',fo:'Philadelphia Field Office'},
  {n:'Muscatine County Jail',c:'Muscatine',s:'IA',fo:'St. Paul Field Office'},
  {n:'Natrona County Detention Center',c:'Casper',s:'WY',fo:'Denver Field Office'},
  {n:'Naval Station Guantanamo Bay (JTF Camp Six and Migrant Ops Center Main A)',c:'',s:'',fo:'Miami Field Office'},
  {n:'Nevada Southern Detention Center',c:'Pahrump',s:'NV',fo:'Salt Lake City Field Office'},
  {n:'North Lake Processing Center',c:'Baldwin',s:'MI',fo:'Detroit Field Office'},
  {n:'Northeast Ohio Correctional Center',c:'Youngstown',s:'OH',fo:'Detroit Field Office'},
  {n:'Northwest ICE Processing Center (NWIPC)',c:'Tacoma',s:'WA',fo:'Seattle Field Office'},
  {n:'Northwest State Correctional Facility',c:'Swanton',s:'VT',fo:'Boston Field Office'},
  {n:'Oldham County Detention Center',c:'LaGrange',s:'KY',fo:'Chicago Field Office'},
  {n:'Orange County Jail',c:'Goshen',s:'NY',fo:'New York City Field Office'},
  {n:'Otay Mesa Detention Center',c:'San Diego',s:'CA',fo:'San Diego Field Office'},
  {n:'Otero County Processing Center',c:'Chaparral',s:'NM',fo:'El Paso Field Office'},
  {n:'Ozark County Jail',c:'Gainesville',s:'MO',fo:'Chicago Field Office'},
  {n:'Pennington County Jail',c:'Rapid City',s:'SD',fo:'St. Paul Field Office'},
  {n:'Phelps County Jail',c:'Holdrege',s:'NE',fo:'St. Paul Field Office'},
  {n:'Phelps County Jail',c:'Rolla',s:'MO',fo:'Chicago Field Office'},
  {n:'Pike County Correctional Facility',c:'Lords Valley',s:'PA',fo:'Philadelphia Field Office'},
  {n:'Pine Prairie ICE Processing Center',c:'Pine Prairie',s:'LA',fo:'New Orleans Field Office'},
  {n:'Plymouth County Correctional Facility',c:'Plymouth',s:'MA',fo:'Boston Field Office'},
  {n:'Polk County Jail',c:'Des Moines',s:'IA',fo:'St. Paul Field Office'},
  {n:'Port Isabel Service Processing Center',c:'Los Fresnos',s:'TX',fo:'Harlingen Field Office'},
  {n:'Pottawattamie County Jail',c:'Council Bluffs',s:'IA',fo:'St. Paul Field Office'},
  {n:'Prairieland Detention Facility',c:'Alvarado',s:'TX',fo:'Dallas Field Office'},
  {n:'Richwood Correctional Center',c:'Monroe',s:'LA',fo:'New Orleans Field Office'},
  {n:'Rio Grande Processing Center',c:'Laredo',s:'TX',fo:'Harlingen Field Office'},
  {n:'River Correctional Center',c:'Ferriday',s:'LA',fo:'New Orleans Field Office'},
  {n:'Rolling Plains Detention Center',c:'Haskell',s:'TX',fo:'Dallas Field Office'},
  {n:'San Luis Regional Detention Center',c:'San Luis',s:'AZ',fo:'San Diego Field Office'},
  {n:'Sarpy County Department of Corrections',c:'Papillion',s:'NE',fo:'St. Paul Field Office'},
  {n:'Seneca County Jail',c:'Tiffin',s:'OH',fo:'Detroit Field Office'},
  {n:'Sherburne County Jail Services',c:'Elk River',s:'MN',fo:'St. Paul Field Office'},
  {n:'Sioux County Jail',c:'Orange City',s:'IA',fo:'St. Paul Field Office'},
  {n:'South Louisiana ICE Processing Center',c:'Basile',s:'LA',fo:'New Orleans Field Office'},
  {n:'South Texas ICE Processing Center',c:'Pearsall',s:'TX',fo:'San Antonio Field Office'},
  {n:'St. Clair County Jail',c:'Port Huron',s:'MI',fo:'Detroit Field Office'},
  {n:'Ste. Genevieve County Detention Center',c:'Ste. Genevieve',s:'MO',fo:'Chicago Field Office'},
  {n:'Stewart Detention Center',c:'Lumpkin',s:'GA',fo:'Atlanta Field Office'},
  {n:'Strafford County Corrections',c:'Dover',s:'NH',fo:'Boston Field Office'},
  {n:'Sweetwater County Detention Center',c:'Rock Springs',s:'WY',fo:'Denver Field Office'},
  {n:'T. Don Hutto Detention Center',c:'Taylor',s:'TX',fo:'San Antonio Field Office'},
  {n:'Torrance County Detention Facility',c:'Estancia',s:'NM',fo:'El Paso Field Office'},
  {n:'Two Bridges Regional Jail',c:'Wiscasset',s:'ME',fo:'Boston Field Office'},
  {n:'Uinta County Detention Center',c:'Evanston',s:'WY',fo:'Salt Lake City Field Office'},
  {n:'Washoe County Jail',c:'Reno',s:'NV',fo:'Salt Lake City Field Office'},
  {n:'West Tennessee Detention Facility',c:'Mason',s:'TN',fo:'New Orleans Field Office'},
  {n:'Winn Correctional Center',c:'Winnfield',s:'LA',fo:'New Orleans Field Office'},
  {n:'Wyatt Detention Facility',c:'Central Falls',s:'RI',fo:'Boston Field Office'}
];

// ── Validators ──────────────────────────────────────────────────
var VALIDATORS = {
  email: function(v) {
    if (!v || !v.trim()) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Invalid email format';
  },
  phone: function(v) {
    if (!v || !v.trim()) return null;
    var digits = v.replace(/[^0-9]/g, '');
    return (digits.length >= 7 && digits.length <= 15) ? null : 'Enter a valid phone number';
  },
  numeric: function(v) {
    if (!v || !v.trim()) return null;
    var n = Number(v);
    return (!isNaN(n) && n >= 0 && n <= 99 && n === Math.floor(n)) ? null : 'Enter a whole number (0\u201399)';
  }
};

function toOrdinal(n) {
  var s = ['th','st','nd','rd'];
  var v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function stateAbbrToName(abbr) {
  return US_STATES[abbr] || abbr;
}

var COURT_SEEDS = [
  {d:'Middle District of Alabama',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ALMDC',e:'https://ecf.almd.uscourts.gov/'},
  {d:'Northern District of Alabama',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ALNDC',e:'https://ecf.alnd.uscourts.gov/'},
  {d:'Southern District of Alabama',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ALSDC',e:'https://ecf.alsd.uscourts.gov/'},
  {d:'District of Alaska',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/AKDC',e:'https://ecf.akd.uscourts.gov/'},
  {d:'District of Arizona',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/AZDC',e:'https://ecf.azd.uscourts.gov/'},
  {d:'Eastern District of Arkansas',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/AREDC',e:'https://ecf.ared.uscourts.gov/'},
  {d:'Western District of Arkansas',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ARWDC',e:'https://ecf.arwd.uscourts.gov/'},
  {d:'Central District of California',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/CACDC',e:'https://ecf.cacd.uscourts.gov/'},
  {d:'Eastern District of California',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/CAEDC',e:'https://ecf.caed.uscourts.gov/'},
  {d:'Northern District of California',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/CANDC',e:'https://ecf.cand.uscourts.gov/'},
  {d:'Southern District of California',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/CASDC',e:'https://ecf.casd.uscourts.gov/'},
  {d:'District of Colorado',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/CODC',e:'https://ecf.cod.uscourts.gov/'},
  {d:'District of Connecticut',ci:'02',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/CTDC',e:'https://ecf.ctd.uscourts.gov/'},
  {d:'District of Delaware',ci:'03',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/DEDC',e:'https://ecf.ded.uscourts.gov/'},
  {d:'District of Columbia',ci:'DC',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/DCDC',e:'https://ecf.dcd.uscourts.gov/'},
  {d:'Middle District of Florida',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/FLMDC',e:'https://ecf.flmd.uscourts.gov/'},
  {d:'Northern District of Florida',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/FLNDC',e:'https://ecf.flnd.uscourts.gov/'},
  {d:'Southern District of Florida',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/FLSDC',e:'https://ecf.flsd.uscourts.gov/'},
  {d:'Middle District of Georgia',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/GAMDC',e:'https://ecf.gamd.uscourts.gov/'},
  {d:'Northern District of Georgia',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/GANDC',e:'https://ecf.gand.uscourts.gov/'},
  {d:'Southern District of Georgia',ci:'11',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/GASDC',e:'https://ecf.gasd.uscourts.gov/'},
  {d:'District of Guam',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/GUDC',e:'https://ecf.gud.uscourts.gov/'},
  {d:'District of Hawaii',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/HIDC',e:'https://ecf.hid.uscourts.gov/'},
  {d:'District of Idaho',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/IDDC',e:'https://ecf.idd.uscourts.gov/'},
  {d:'Central District of Illinois',ci:'07',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ILCDC',e:'https://ecf.ilcd.uscourts.gov/'},
  {d:'Northern District of Illinois',ci:'07',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ILNDC',e:'https://ecf.ilnd.uscourts.gov/'},
  {d:'Southern District of Illinois',ci:'07',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ILSDC',e:'https://ecf.ilsd.uscourts.gov/'},
  {d:'Northern District of Indiana',ci:'07',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/INNDC',e:'https://ecf.innd.uscourts.gov/'},
  {d:'Southern District of Indiana',ci:'07',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/INSDC',e:'https://ecf.insd.uscourts.gov/'},
  {d:'Northern District of Iowa',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/IANDC',e:'https://ecf.iand.uscourts.gov/'},
  {d:'Southern District of Iowa',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/IASDC',e:'https://ecf.iasd.uscourts.gov/'},
  {d:'District of Kansas',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/KSDC',e:'https://ecf.ksd.uscourts.gov/'},
  {d:'Eastern District of Kentucky',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/KYEDC',e:'https://ecf.kyed.uscourts.gov/'},
  {d:'Western District of Kentucky',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/KYWDC',e:'https://ecf.kywd.uscourts.gov/'},
  {d:'Eastern District of Louisiana',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/LAEDC',e:'https://ecf.laed.uscourts.gov/'},
  {d:'Middle District of Louisiana',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/LAMDC',e:'https://ecf.lamd.uscourts.gov/'},
  {d:'Western District of Louisiana',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/LAWDC',e:'https://ecf.lawd.uscourts.gov/'},
  {d:'District of Maine',ci:'01',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MEDC',e:'https://ecf.med.uscourts.gov/'},
  {d:'District of Maryland',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MDDC',e:'https://ecf.mdd.uscourts.gov/'},
  {d:'District of Massachusetts',ci:'01',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MADC',e:'https://ecf.mad.uscourts.gov/'},
  {d:'Eastern District of Michigan',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MIEDC',e:'https://ecf.mied.uscourts.gov/'},
  {d:'Western District of Michigan',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MIWDC',e:'https://ecf.miwd.uscourts.gov/'},
  {d:'District of Minnesota',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MNDC',e:'https://ecf.mnd.uscourts.gov/'},
  {d:'Northern District of Mississippi',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MSNDC',e:'https://ecf.msnd.uscourts.gov/'},
  {d:'Southern District of Mississippi',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MSSDC',e:'https://ecf.mssd.uscourts.gov/'},
  {d:'Eastern District of Missouri',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MOEDC',e:'https://ecf.moed.uscourts.gov/'},
  {d:'Western District of Missouri',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MOWDC',e:'https://ecf.mowd.uscourts.gov/'},
  {d:'District of Montana',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/MTDC',e:'https://ecf.mtd.uscourts.gov/'},
  {d:'District of Nebraska',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NEDC',e:'https://ecf.ned.uscourts.gov/'},
  {d:'District of Nevada',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NVDC',e:'https://ecf.nvd.uscourts.gov/'},
  {d:'District of New Hampshire',ci:'01',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NHDC',e:'https://ecf.nhd.uscourts.gov/'},
  {d:'District of New Jersey',ci:'03',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NJDC',e:'https://ecf.njd.uscourts.gov/'},
  {d:'District of New Mexico',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NMDC',e:'https://ecf.nmd.uscourts.gov/'},
  {d:'Eastern District of New York',ci:'02',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NYEDC',e:'https://ecf.nyed.uscourts.gov/'},
  {d:'Northern District of New York',ci:'02',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NYNDC',e:'https://ecf.nynd.uscourts.gov/'},
  {d:'Southern District of New York',ci:'02',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NYSDC',e:'https://ecf.nysd.uscourts.gov/'},
  {d:'Western District of New York',ci:'02',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NYWDC',e:'https://ecf.nywd.uscourts.gov/'},
  {d:'Eastern District of North Carolina',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NCEDC',e:'https://ecf.nced.uscourts.gov/'},
  {d:'Middle District of North Carolina',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NCMDC',e:'https://ecf.ncmd.uscourts.gov/'},
  {d:'Western District of North Carolina',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NCWDC',e:'https://ecf.ncwd.uscourts.gov/'},
  {d:'District of North Dakota',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NDDC',e:'https://ecf.ndd.uscourts.gov/'},
  {d:'District of the Northern Mariana Islands',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/NMIDC',e:'https://ecf.nmid.uscourts.gov/'},
  {d:'Northern District of Ohio',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/OHNDC',e:'https://ecf.ohnd.uscourts.gov/'},
  {d:'Southern District of Ohio',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/OHSDC',e:'https://ecf.ohsd.uscourts.gov/'},
  {d:'Eastern District of Oklahoma',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/OKEDC',e:'https://ecf.oked.uscourts.gov/'},
  {d:'Northern District of Oklahoma',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/OKNDC',e:'https://ecf.oknd.uscourts.gov/'},
  {d:'Western District of Oklahoma',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/OKWDC',e:'https://ecf.okwd.uscourts.gov/'},
  {d:'District of Oregon',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/ORDC',e:'https://ecf.ord.uscourts.gov/'},
  {d:'Eastern District of Pennsylvania',ci:'03',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/PAEDC',e:'https://ecf.paed.uscourts.gov/'},
  {d:'Middle District of Pennsylvania',ci:'03',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/PAMDC',e:'https://ecf.pamd.uscourts.gov/'},
  {d:'Western District of Pennsylvania',ci:'03',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/PAWDC',e:'https://ecf.pawd.uscourts.gov/'},
  {d:'District of Puerto Rico',ci:'01',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/PRDC',e:'https://ecf.prd.uscourts.gov/'},
  {d:'District of Rhode Island',ci:'01',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/RIDC',e:'https://ecf.rid.uscourts.gov/'},
  {d:'District of South Carolina',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/SCDC',e:'https://ecf.scd.uscourts.gov/'},
  {d:'District of South Dakota',ci:'08',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/SDDC',e:'https://ecf.sdd.uscourts.gov/'},
  {d:'Eastern District of Tennessee',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TNEDC',e:'https://ecf.tned.uscourts.gov/'},
  {d:'Middle District of Tennessee',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TNMDC',e:'https://ecf.tnmd.uscourts.gov/'},
  {d:'Western District of Tennessee',ci:'06',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TNWDC',e:'https://ecf.tnwd.uscourts.gov/'},
  {d:'Eastern District of Texas',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TXEDC',e:'https://ecf.txed.uscourts.gov/'},
  {d:'Northern District of Texas',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TXNDC',e:'https://ecf.txnd.uscourts.gov/'},
  {d:'Southern District of Texas',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TXSDC',e:'https://ecf.txsd.uscourts.gov/'},
  {d:'Western District of Texas',ci:'05',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TXWDC',e:'https://ecf.txwd.uscourts.gov/'},
  {d:'District of Utah',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/UTDC',e:'https://ecf.utd.uscourts.gov/'},
  {d:'District of Vermont',ci:'02',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/VTDC',e:'https://ecf.vtd.uscourts.gov/'},
  {d:'District of the Virgin Islands',ci:'03',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/VIDC',e:'https://ecf.vid.uscourts.gov/'},
  {d:'Eastern District of Virginia',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/VAEDC',e:'https://ecf.vaed.uscourts.gov/'},
  {d:'Western District of Virginia',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/VAWDC',e:'https://ecf.vawd.uscourts.gov/'},
  {d:'Eastern District of Washington',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/WAEDC',e:'https://ecf.waed.uscourts.gov/'},
  {d:'Western District of Washington',ci:'09',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/WAWDC',e:'https://ecf.wawd.uscourts.gov/'},
  {d:'Northern District of West Virginia',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/WVNDC',e:'https://ecf.wvnd.uscourts.gov/'},
  {d:'Southern District of West Virginia',ci:'04',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/WVSDC',e:'https://ecf.wvsd.uscourts.gov/'},
  {d:'Eastern District of Wisconsin',ci:'07',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/WIEDC',e:'https://ecf.wied.uscourts.gov/'},
  {d:'Western District of Wisconsin',ci:'07',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/WIWDC',e:'https://ecf.wiwd.uscourts.gov/'},
  {d:'District of Wyoming',ci:'10',p:'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/WYDC',e:'https://ecf.wyd.uscourts.gov/'}
];

// ── Field Definitions ────────────────────────────────────────────
var FACILITY_FIELDS = [
  { key: 'name', label: 'Facility Name', ph: 'South Louisiana ICE Processing Center' },
  { key: 'city', label: 'City', ph: 'Basile' },
  { key: 'state', label: 'State', ph: 'Louisiana', type: 'enum', options: US_STATE_NAMES },
  { key: 'warden', label: 'Warden', ph: 'John Smith' },
  { key: 'fieldOfficeName', label: 'Field Office', ph: 'New Orleans Field Office' },
  { key: 'fieldOfficeDirector', label: 'Field Office Director', ph: 'Jane Doe' },
];
var COURT_FIELDS = [
  { key: 'district', label: 'District', ph: 'Middle District of Tennessee' },
  { key: 'division', label: 'Division', ph: 'Nashville Division' },
  { key: 'circuit', label: 'Circuit', ph: '6' },
  { key: 'ecfUrl', label: 'CM/ECF Portal', ph: 'https://ecf.tnmd.uscourts.gov/', type: 'url' },
  { key: 'pacerUrl', label: 'PACER Page', ph: 'https://pacer.uscourts.gov/file-case/court-cmecf-lookup/court/TNMDC', type: 'url' },
];
var NATIONAL_FIELDS = [
  { key: 'iceDirector', label: 'ICE Director', ph: 'Tom Homan' },
  { key: 'iceDirectorTitle', label: 'ICE Title', ph: 'Director', type: 'enum', options: ICE_TITLE_OPTIONS },
  { key: 'dhsSecretary', label: 'DHS Secretary', ph: 'Kristi Noem' },
  { key: 'attorneyGeneral', label: 'Attorney General', ph: 'Pam Bondi' },
];
var ATT_PROFILE_FIELDS = [
  { key: 'name', label: 'Name', ph: '' },
  { key: 'barNo', label: 'Bar No.', ph: '' },
  { key: 'firm', label: 'Firm', ph: '' },
  { key: 'address', label: 'Address', ph: '' },
  { key: 'cityStateZip', label: 'City/St/Zip', ph: '' },
  { key: 'phone', label: 'Phone', ph: '', validate: VALIDATORS.phone },
  { key: 'fax', label: 'Fax', ph: '', validate: VALIDATORS.phone },
  { key: 'email', label: 'Email', ph: '', validate: VALIDATORS.email },
  { key: 'proHacVice', label: 'Pro Hac Vice', ph: '*Pro hac vice pending' },
];
var CLIENT_FIELDS = [
  { key: 'name', label: 'Full Name', ph: 'Juan Carlos Rivera' },
  { key: 'country', label: 'Country', ph: 'Honduras', type: 'enum', options: COUNTRIES },
  { key: 'yearsInUS', label: 'Years in U.S.', ph: '12', validate: VALIDATORS.numeric },
  { key: 'entryDate', label: 'Entry Date', ph: 'approximately 2013', type: 'date' },
  { key: 'entryMethod', label: 'Entry Method', ph: 'without inspection', type: 'enum-or-custom', options: ENTRY_METHOD_OPTIONS },
  { key: 'apprehensionLocation', label: 'Arrest Location', ph: 'Nashville, Tennessee' },
  { key: 'apprehensionDate', label: 'Arrest Date', ph: 'January 15, 2026', type: 'date' },
  { key: 'criminalHistory', label: 'Criminal History', ph: 'has no criminal record', type: 'enum-or-custom', options: CRIMINAL_HISTORY_OPTIONS },
  { key: 'communityTies', label: 'Community Ties', ph: 'has strong family and community ties', type: 'enum-or-custom', options: COMMUNITY_TIES_OPTIONS },
];
var FILING_FIELDS = [
  { key: 'filingDate', label: 'Filing Date', ph: 'February 19, 2026', type: 'date-group' },
  { key: 'filingDay', label: 'Filing Day', ph: '19th' },
  { key: 'filingMonthYear', label: 'Month & Year', ph: 'February, 2026' },
];
var RESPONDENT_FIELDS = [
  { key: 'warden', label: 'Warden', ph: '' },
  { key: 'fieldOfficeDirector', label: 'FOD', ph: '' },
  { key: 'fieldOfficeName', label: 'Field Office', ph: '' },
];
var NATIONAL_OVERRIDE_FIELDS = [
  { key: 'natIceDirector', label: 'ICE Director', ph: '' },
  { key: 'natIceDirectorTitle', label: 'ICE Title', ph: '', type: 'enum', options: ICE_TITLE_OPTIONS },
  { key: 'natDhsSecretary', label: 'DHS Secretary', ph: '' },
  { key: 'natAttorneyGeneral', label: 'Attorney General', ph: '' },
];

var DEFAULT_PAGE_SETTINGS = {
  headerLeft: '', headerCenter: '', headerRight: '',
  footerLeft: '{{CASE_NUMBER}}', footerCenter: '', footerRight: '{{PAGE}}',
  showHeaderOnFirstPage: false,
  showFooterOnFirstPage: true
};

function buildVarMap(c, p, a1, a2, nat) {
  c = c || {}; p = p || {}; a1 = a1 || {}; a2 = a2 || {}; nat = nat || {};
  return {
    COURT_DISTRICT: p.district || '', COURT_DIVISION: p.division || '', COURT_WEBSITE: p.courtWebsite || '',
    CASE_NUMBER: p.caseNumber || '',
    PETITIONER_FULL_NAME: c.name || '', PETITIONER_COUNTRY: c.country || '',
    PETITIONER_YEARS_IN_US: c.yearsInUS || '', PETITIONER_ENTRY_DATE: c.entryDate || '',
    PETITIONER_ENTRY_METHOD: c.entryMethod || '',
    PETITIONER_APPREHENSION_LOCATION: c.apprehensionLocation || '',
    PETITIONER_APPREHENSION_DATE: c.apprehensionDate || '',
    PETITIONER_CRIMINAL_HISTORY: c.criminalHistory || '',
    PETITIONER_COMMUNITY_TIES: c.communityTies || '',
    DETENTION_FACILITY_NAME: p.facilityName || '',
    DETENTION_FACILITY_CITY: p.facilityCity || '',
    DETENTION_FACILITY_STATE: p.facilityState || '',
    WARDEN_NAME: p.warden || '', FIELD_OFFICE_DIRECTOR: p.fieldOfficeDirector || '',
    FIELD_OFFICE_NAME: p.fieldOfficeName || '',
    ICE_DIRECTOR: p.natIceDirector || nat.iceDirector || '', ICE_DIRECTOR_TITLE: p.natIceDirectorTitle || nat.iceDirectorTitle || '',
    DHS_SECRETARY: p.natDhsSecretary || nat.dhsSecretary || '', ATTORNEY_GENERAL: p.natAttorneyGeneral || nat.attorneyGeneral || '',
    FILING_DATE: p.filingDate || '', FILING_DAY: p.filingDay || '',
    FILING_MONTH_YEAR: p.filingMonthYear || '',
    ATTORNEY1_NAME: a1.name || '', ATTORNEY1_BAR_NO: a1.barNo || '',
    ATTORNEY1_FIRM: a1.firm || '', ATTORNEY1_ADDRESS: a1.address || '',
    ATTORNEY1_CITY_STATE_ZIP: a1.cityStateZip || '',
    ATTORNEY1_PHONE: a1.phone || '', ATTORNEY1_FAX: a1.fax || '',
    ATTORNEY1_EMAIL: a1.email || '',
    ATTORNEY2_NAME: a2.name || '', ATTORNEY2_BAR_NO: a2.barNo || '',
    ATTORNEY2_FIRM: a2.firm || '', ATTORNEY2_ADDRESS: a2.address || '',
    ATTORNEY2_CITY_STATE_ZIP: a2.cityStateZip || '',
    ATTORNEY2_PHONE: a2.phone || '', ATTORNEY2_EMAIL: a2.email || '',
    ATTORNEY2_PRO_HAC: a2.proHacVice || '',
  };
}

// ── Default Template Blocks ──────────────────────────────────────
var DEFAULT_BLOCKS = [
  // Court title
  { id: 'ct-1', type: 'title', content: 'UNITED STATES DISTRICT COURT' },
  { id: 'ct-2', type: 'title', content: 'FOR THE {{COURT_DISTRICT}}' },
  { id: 'ct-3', type: 'title', content: '{{COURT_DIVISION}}' },
  // Caption
  { id: 'cap-pet', type: 'cap-name', content: '{{PETITIONER_FULL_NAME}},' },
  { id: 'cap-role', type: 'cap-center', content: 'Petitioner-Plaintiff,' },
  { id: 'cap-v', type: 'cap-center', content: 'v.' },
  { id: 'cap-r1', type: 'cap-resp', content: '{{WARDEN_NAME}}, in his official capacity as Warden of {{DETENTION_FACILITY_NAME}};' },
  { id: 'cap-r2', type: 'cap-resp', content: '{{FIELD_OFFICE_DIRECTOR}}, in his official capacity as Field Office Director of the {{FIELD_OFFICE_NAME}} of Enforcement and Removal Operations, U.S. Immigration and Customs Enforcement;' },
  { id: 'cap-r3', type: 'cap-resp', content: 'U.S. Department of Homeland Security;' },
  { id: 'cap-r4', type: 'cap-resp', content: '{{ICE_DIRECTOR}}, in his official capacity as {{ICE_DIRECTOR_TITLE}}, Immigration and Customs Enforcement, U.S. Department of Homeland Security;' },
  { id: 'cap-r5', type: 'cap-resp', content: '{{DHS_SECRETARY}}, in her official capacity as Secretary, U.S. Department of Homeland Security; and' },
  { id: 'cap-r6', type: 'cap-resp', content: '{{ATTORNEY_GENERAL}}, in her official capacity as Attorney General of the United States;\nRespondents-Defendants.' },
  { id: 'cap-case', type: 'cap-case', content: 'C/A No. {{CASE_NUMBER}}' },
  { id: 'cap-title', type: 'cap-doctitle', content: 'PETITION FOR WRIT OF HABEAS CORPUS AND COMPLAINT FOR DECLARATORY AND INJUNCTIVE RELIEF' },
  // Introduction
  { id: 'h-intro', type: 'heading', content: 'INTRODUCTION' },
  { id: 'p-1', type: 'para', content: '1. Petitioner-Plaintiff {{PETITIONER_FULL_NAME}} ("Petitioner") is a citizen of {{PETITIONER_COUNTRY}} who has resided in the U.S. for {{PETITIONER_YEARS_IN_US}} years. On information and belief, Immigration and Customs Enforcement ("ICE") officers apprehended him near his home in {{PETITIONER_APPREHENSION_LOCATION}}, on or about {{PETITIONER_APPREHENSION_DATE}}.' },
  { id: 'p-2', type: 'para', content: '2. Petitioner is currently detained at the {{DETENTION_FACILITY_NAME}} in {{DETENTION_FACILITY_CITY}}, {{DETENTION_FACILITY_STATE}}.' },
  { id: 'p-3', type: 'para', content: '3. On September 5, 2025, the Board of Immigration Appeals ("BIA") issued a precedential decision that unlawfully reinterpreted the Immigration and Nationality Act ("INA"). See <em>Matter of Yajure Hurtado</em>, 29 I&N Dec. 216 (BIA 2025). Prior to this decision, noncitizens like Petitioner who had lived in the U.S. for many years and were apprehended by ICE in the interior of the country were detained pursuant to 8 U.S.C. \u00a7 1226(a) and eligible to seek bond hearings before Immigration Judges ("IJs"). Instead, in conflict with nearly thirty years of legal precedent, Petitioner is now considered subject to mandatory detention under 8 U.S.C. \u00a7 1225(b)(2)(A) and has no opportunity for release on bond while his removal proceedings are pending.' },
  { id: 'p-4', type: 'para', content: '4. Petitioner\u2019s detention pursuant to \u00a7 1225(b)(2)(A) violates the plain language of the INA and its implementing regulations. Petitioner, who has resided in the U.S. for nearly {{PETITIONER_YEARS_IN_US}} years and who was apprehended in the interior of the U.S., should not be considered an "applicant for admission" who is "seeking admission." Rather, he should be detained pursuant to 8 U.S.C. \u00a7 1226(a), which allows for release on conditional parole or bond.' },
  { id: 'p-5', type: 'para', content: '5. Petitioner seeks declaratory relief that he is subject to detention under \u00a7 1226(a) and its implementing regulations and asks that this Court either order Respondents to release Petitioner from custody or provide him with a bond hearing.' },
  // Custody
  { id: 'h-cust', type: 'heading', content: 'CUSTODY' },
  { id: 'p-6', type: 'para', content: '6. Petitioner is currently in the custody of Immigration and Customs Enforcement ("ICE") at the {{DETENTION_FACILITY_NAME}} in {{DETENTION_FACILITY_CITY}}, {{DETENTION_FACILITY_STATE}}. He is therefore in "\u2018custody\u2019 of [the DHS] within the meaning of the habeas corpus statute." <em>Jones v. Cunningham</em>, 371 U.S. 236, 243 (1963).' },
  // Jurisdiction
  { id: 'h-jur', type: 'heading', content: 'JURISDICTION' },
  { id: 'p-7', type: 'para', content: '7. This court has jurisdiction under 28 U.S.C. \u00a7 2241 (habeas corpus), 28 U.S.C. \u00a7 1331 (federal question), Article I, \u00a7 9, cl. 2 of the United States Constitution (Suspension Clause), and the Immigration and Nationality Act ("INA"), 8 U.S.C. \u00a7 1101 et seq.' },
  { id: 'p-8', type: 'para', content: '8. This Court may grant relief under the habeas corpus statutes, 28 U.S.C. \u00a7 2241 et seq., the Declaratory Judgment Act, 28 U.S.C. \u00a7 2201 et seq., the All Writs Act, 28 U.S.C. \u00a7 1651, and the Immigration and Nationality Act, 8 U.S.C. \u00a7 1252(e)(2).' },
  { id: 'p-9', type: 'para', content: '9. Federal district courts have jurisdiction to hear habeas claims by non-citizens challenging both the lawfulness and the constitutionality of their detention. See <em>Zadvydas v. Davis</em>, 533 U.S. 678, 687 (2001).' },
  // Requirements of 28 U.S.C. 2241, 2243
  { id: 'h-req', type: 'heading', content: 'REQUIREMENTS OF 28 U.S.C. \u00a7\u00a7 2241, 2243' },
  { id: 'p-10', type: 'para', content: '10. The Court must grant the petition for writ of habeas corpus or issue an order to show cause ("OSC") to Respondents "forthwith," unless Petitioner is not entitled to relief. 28 U.S.C. \u00a7 2243. If an OSC is issued, the Court must require Respondents to file a return "within three days unless for good cause additional time, not exceeding twenty days, is allowed." Id.' },
  { id: 'p-11', type: 'para', content: '11. Petitioner is "in custody" for the purpose of \u00a7 2241 because Petitioner is arrested and detained by Respondents.' },
  // Venue
  { id: 'h-ven', type: 'heading', content: 'VENUE' },
  { id: 'p-12', type: 'para', content: '12. Venue is properly before this Court pursuant to 28 U.S.C. \u00a7 1391(e) because Respondents are employees or officers of the United States acting in their official capacity and because a substantial part of the events or omissions giving rise to the claim occurred in the {{COURT_DISTRICT}}. Petitioner is under the jurisdiction of ICE\u2019s {{FIELD_OFFICE_NAME}}, and he is currently detained at the {{DETENTION_FACILITY_NAME}} in {{DETENTION_FACILITY_CITY}}, {{DETENTION_FACILITY_STATE}}.' },
  // Exhaustion
  { id: 'h-exh', type: 'heading', content: 'EXHAUSTION OF ADMINISTRATIVE REMEDIES' },
  { id: 'p-13', type: 'para', content: '13. Administrative exhaustion is unnecessary as it would be futile. See, e.g., <em>Aguilar v. Lewis</em>, 50 F. Supp. 2d 539, 542\u201343 (E.D. Va. 1999).' },
  { id: 'p-14', type: 'para', content: '14. It would be futile for Petitioner to seek a custody redetermination hearing before an IJ due to the BIA\u2019s recent decision holding that anyone who has entered the U.S. without inspection is now considered an "applicant for admission" who is "seeking admission" and therefore subject to mandatory detention under \u00a7 1225(b)(2)(A). See <em>Matter of Yajure Hurtado</em>, 29 I&N Dec. 216 (BIA 2025); see also <em>Zaragoza Mosqueda v. Noem</em>, 2025 WL 2591530, at *7 (C.D. Cal. Sept. 8, 2025) (noting that BIA\u2019s decision in <em>Yajure Hurtado</em> renders exhaustion futile).' },
  { id: 'p-15', type: 'para', content: '15. Additionally, the agency does not have jurisdiction to review Petitioner\u2019s claim of unlawful custody in violation of his due process rights, and it would therefore be futile for him to pursue administrative remedies. <em>Reno v. Amer.-Arab Anti-Discrim. Comm.</em>, 525 U.S. 471, 119 S.Ct. 936, 142 L.Ed.2d 940 (1999) (finding exhaustion to be a "futile exercise because the agency does not have jurisdiction to review" constitutional claims).' },
  // Parties
  { id: 'h-par', type: 'heading', content: 'PARTIES' },
  { id: 'p-16', type: 'para', content: '16. Petitioner {{PETITIONER_FULL_NAME}} is from {{PETITIONER_COUNTRY}} and has resided in the U.S. since {{PETITIONER_ENTRY_DATE}}. He is currently detained in the {{DETENTION_FACILITY_NAME}}.' },
  { id: 'p-17', type: 'para', content: '17. Respondent {{WARDEN_NAME}} is sued in his official capacity as Warden of the {{DETENTION_FACILITY_NAME}}. In his official capacity, {{WARDEN_NAME}} is Petitioner\u2019s immediate custodian.' },
  { id: 'p-18', type: 'para', content: '18. Respondent {{FIELD_OFFICE_DIRECTOR}} is sued in his official capacity as Field Office Director, {{FIELD_OFFICE_NAME}}, Enforcement and Removal Operations, U.S. Immigration & Customs Enforcement ("ICE"). In his official capacity, Respondent {{FIELD_OFFICE_DIRECTOR}} is the legal custodian of Petitioner.' },
  { id: 'p-19', type: 'para', content: '19. Respondent {{ICE_DIRECTOR}} is sued in his official capacity as {{ICE_DIRECTOR_TITLE}} of ICE. As the {{ICE_DIRECTOR_TITLE}} of ICE, Respondent {{ICE_DIRECTOR}} is a legal custodian of Petitioner.' },
  { id: 'p-20', type: 'para', content: '20. Respondent {{DHS_SECRETARY}} is sued in her official capacity as Secretary of Homeland Security. As the head of the Department of Homeland Security, the agency tasked with enforcing immigration laws, Secretary {{DHS_SECRETARY}} is Petitioner\u2019s ultimate legal custodian.' },
  { id: 'p-21', type: 'para', content: '21. Respondent {{ATTORNEY_GENERAL}} is sued in her official capacity as the Attorney General of the United States. As Attorney General, she has authority over the Department of Justice and is charged with faithfully administering the immigration laws of the United States.' },
  // Legal Background and Argument
  { id: 'h-leg', type: 'heading', content: 'LEGAL BACKGROUND AND ARGUMENT' },
  { id: 'p-22', type: 'para', content: '22. The INA prescribes three basic forms of detention for noncitizens in removal proceedings.' },
  { id: 'p-23', type: 'para', content: '23. First, individuals detained pursuant to 8 U.S.C. \u00a7 1226(a) are generally entitled to a bond hearing, unless they have been arrested, charged with, or convicted of certain crimes and are subject to mandatory detention. See 8 U.S.C. \u00a7\u00a7 1226(a), 1226(c) (listing grounds for mandatory detention); see also 8 C.F.R. \u00a7\u00a7 1003.19(a) (immigration judges may review custody determinations made by DHS), 1236.1(d) (same).' },
  { id: 'p-24', type: 'para', content: '24. Second, the INA provides for mandatory detention of noncitizens subject to expedited removal under 8 U.S.C. \u00a7 1225(b)(1) as well as other recent arrivals deemed to be "seeking admission" under \u00a7 1225(b)(2).' },
  { id: 'p-25', type: 'para', content: '25. Third, the INA authorizes detention of noncitizens who have received a final order of removal, including those in withholding-only proceedings. See 8 U.S.C. \u00a7 1231(a)\u2013(b).' },
  { id: 'p-26', type: 'para', content: '26. Thus, in the decades that followed, most people who entered without inspection and were thereafter detained and placed in standard removal proceedings were considered for release on bond and received bond hearings before an IJ, unless their criminal history rendered them ineligible.' },
  { id: 'p-27', type: 'para', content: '27. For decades, long-term residents of the U.S. who entered without inspection and were subsequently apprehended by ICE in the interior of the country have been detained pursuant to \u00a7 1226 and entitled to bond hearings before an IJ, unless barred from doing so due to their criminal history.' },
  { id: 'p-28', type: 'para', content: '28. In July 2025, however, ICE began asserting that all individuals who entered without inspection should be considered "seeking admission" and therefore subject to mandatory detention under 8 U.S.C. \u00a7 1225(b)(2)(A).' },
  { id: 'p-29', type: 'para', content: '29. On September 5, 2025, the BIA issued a precedential decision adopting this interpretation, despite its departure from the INA\u2019s text, federal precedent, and existing regulations. <em>Matter of Yajure Hurtado</em>, 29 I&N Dec. 216 (BIA 2025).' },
  { id: 'p-30', type: 'para', content: '30. Respondents\u2019 new legal interpretation is contrary to the statutory framework and its implementing regulations.' },
  { id: 'p-31', type: 'para', content: '31. Courts across the country, including this Court, have rejected this interpretation and instead have consistently found that \u00a7 1226, not \u00a7 1225(b)(2), authorizes detention of noncitizens who entered without inspection and were later apprehended in the interior of the country. See, e.g., <em>Hasan v. Crawford</em>, No. 1:25-CV-1408 (LMB/IDD), 2025 WL 2682255 (E.D. Va. Sept. 19, 2025); <em>Quispe Ardiles v. Noem</em>, No. 1:25-cv-01382 (E.D. Va. Sept. 30, 2025); <em>Venancio v. Hyde et al</em>, No. 1:25-cv-12616 (D. Mass. Oct. 9, 2025); <em>Artiga v. Genalo</em>, No. 2:25-cv-05208 (E.D.N.Y. Oct. 7, 2025); <em>Sampiao v. Hyde</em>, 2025 WL 2607924 (D. Mass. Sept. 9, 2025); <em>Leal-Hernandez v. Noem</em>, 2025 WL 2430025 (D. Md. Aug. 24, 2025); <em>Lopez Benitez v. Francis</em>, 2025 WL 2371588 (S.D.N.Y. Aug. 13, 2025); <em>Jimenez v. FCI Berlin, Warden</em>, No. 25-cv-326-LM-AJ (D.N.H. Sept. 8, 2025); <em>Kostak v. Trump</em>, 2025 WL 2472136 (W.D. La. Aug. 27, 2025); <em>Cuevas Guzman v. Andrews</em>, 2025 WL 2617256, at *3 n.4 (E.D. Cal. Sept. 9, 2025).' },
  { id: 'p-32', type: 'para', content: '32. Under the Supreme Court\u2019s recent decision in <em>Loper Bright v. Raimondo</em>, this Court should independently interpret the statute and give the BIA\u2019s expansive interpretation of \u00a7 1225(b)(2) no weight, as it conflicts with the statute, regulations, and precedent. 603 U.S. 369 (2024).' },
  { id: 'p-33', type: 'para', content: '33. The detention provisions at \u00a7 1226(a) and \u00a7 1225(b)(2) were enacted as part of the Illegal Immigration Reform and Immigrant Responsibility Act ("IIRIRA") of 1996, Pub. L. No. 104-208, Div. C, \u00a7\u00a7 302\u201303, 110 Stat. 3009-546, 3009\u2013582 to 3009\u2013583, 3009\u2013585. Following IIRIRA, the Executive Office for Immigration Review ("EOIR") issued regulations clarifying that individuals who entered the country without inspection were not considered detained under \u00a7 1225, but rather under \u00a7 1226(a). See Inspection and Expedited Removal of Aliens; Detention and Removal of Aliens; Conduct of Removal Proceedings; Asylum Procedures, 62 Fed. Reg. 10312, 10323 (Mar. 6, 1997) ("[d]espite being applicants for admission, aliens who are present without having been admitted or paroled (formerly referred to as aliens who entered without inspection) will be eligible for bond and bond redetermination").' },
  { id: 'p-34', type: 'para', content: '34. The statutory context and structure also make clear that \u00a7 1226 applies to individuals who have not been admitted and entered without inspection. In 2025, Congress added new mandatory detention grounds to \u00a7 1226(c) that apply only to noncitizens who have not been admitted. By specifically referencing inadmissibility for entry without inspection under 8 U.S.C. \u00a7 1182(6)(A), Congress made clear that such individuals are otherwise covered by \u00a7 1226(a). Thus, \u00a7 1226 plainly applies to noncitizens charged as inadmissible, including those present without admission or parole.' },
  { id: 'p-35', type: 'para', content: '35. The Supreme Court has explained that \u00a7 1225(b) is concerned "primarily [with those] seeking entry," and is generally imposed "at the Nation\u2019s borders and ports of entry, where the Government must determine whether [a noncitizen] seeking to enter the country is admissible." <em>Jennings v. Rodriguez</em>, 583 U.S. 281, 297, 298 (2018). In contrast, Section 1226 "authorizes the Government to detain certain aliens already in the country pending the outcome of removal proceedings." Id. at 289 (emphases added).' },
  { id: 'p-36', type: 'para', content: '36. Furthermore, \u00a7 1225(b)(2) specifically applies only to those "seeking admission." Similarly, the implementing regulations at 8 C.F.R. \u00a7 1.2 addresses noncitizens who are "coming or attempting to come into the United States." The use of the present progressive tense would exclude noncitizens like Petitioner who are apprehended in the interior years after they entered, as they are no longer "seeking admission" or "coming [...] into the United States." See <em>Martinez v. Hyde</em>, 2025 WL 2084238 at *6 (D. Mass. July 24, 2025) (citing the use of present and present progressive tense to support conclusion that INA \u00a7 1225(b)(2) does not apply to individuals apprehended in the interior); see also <em>Al Otro Lado v. McAleenan</em>, 394 F. Supp. 3d 1168, 1200 (S.D. Cal. 2019) (construing "is arriving" in INA \u00a7 235(b)(1)(A)(i) and observing that "[t]he use of the present progressive, like use of the present participle, denotes an ongoing process").' },
  { id: 'p-37', type: 'para', content: '37. Accordingly, the mandatory detention provision of \u00a7 1225(b)(2) does not apply to Petitioner, who entered the U.S. years before he was apprehended.' },
  // Statement of Facts
  { id: 'h-facts', type: 'heading', content: 'STATEMENT OF FACTS' },
  { id: 'p-38', type: 'para', content: '38. Petitioner is a citizen of {{PETITIONER_COUNTRY}}.' },
  { id: 'p-39', type: 'para', content: '39. On information and belief, Petitioner entered the U.S. {{PETITIONER_ENTRY_METHOD}} in {{PETITIONER_ENTRY_DATE}}, and he has resided in the U.S. since then.' },
  { id: 'p-40', type: 'para', content: '40. On information and belief, Petitioner {{PETITIONER_CRIMINAL_HISTORY}}.' },
  { id: 'p-41', type: 'para', content: '41. On information and belief, Petitioner was arrested by immigration authorities in {{PETITIONER_APPREHENSION_LOCATION}} on {{PETITIONER_APPREHENSION_DATE}}.' },
  { id: 'p-42', type: 'para', content: '42. He is now detained at the {{DETENTION_FACILITY_NAME}}.' },
  { id: 'p-43', type: 'para', content: '43. Without relief from this Court, he faces the prospect of continued detention without any access to a bond hearing.' },
  // Count I
  { id: 'h-c1', type: 'heading', content: 'COUNT I' },
  { id: 'p-c1-sub', type: 'para', content: 'Violation of 8 U.S.C. \u00a7 1226(a) Unlawful Denial of Release on Bond' },
  { id: 'p-44', type: 'para', content: '44. Petitioner restates and realleges all paragraphs as if fully set forth here.' },
  { id: 'p-45', type: 'para', content: '45. Petitioner may be detained, if at all, pursuant to 8 U.S.C. \u00a7 1226(a).' },
  { id: 'p-46', type: 'para', content: '46. Under \u00a7 1226(a) and its associated regulations, Petitioner is entitled to a bond hearing. See 8 C.F.R. 236.1(d) & 1003.19(a)-(f).' },
  { id: 'p-47', type: 'para', content: '47. Petitioner has not been, and will not be, provided with a bond hearing as required by law.' },
  { id: 'p-48', type: 'para', content: '48. Petitioner\u2019s continuing detention is therefore unlawful.' },
  // Count II
  { id: 'h-c2', type: 'heading', content: 'COUNT II' },
  { id: 'p-c2-sub', type: 'para', content: 'Violation of the Bond Regulations, 8 C.F.R. \u00a7\u00a7 236.1, 1236.1 and 1003.19 Unlawful Denial of Release on Bond' },
  { id: 'p-49', type: 'para', content: '49. Petitioner restates and realleges all paragraphs as if fully set forth here.' },
  { id: 'p-50', type: 'para', content: '50. In 1997, after Congress amended the INA through IIRIRA, EOIR and the then-Immigration and Naturalization Service issued an interim rule to interpret and apply IIRIRA. Specifically, under the heading of "Apprehension, Custody, and Detention of [Noncitizens]," the agencies explained that "[d]espite being applicants for admission, [noncitizens] who are present without having been admitted or paroled (formerly referred to as [noncitizens] who entered without inspection) will be eligible for bond and bond redetermination." 62 Fed. Reg. at 10323. The agencies thus made clear that individuals who had entered without inspection were eligible for consideration for bond and bond hearings before IJs under 8 U.S.C. \u00a7 1226 and its implementing regulations.' },
  { id: 'p-51', type: 'para', content: '51. The application of \u00a7 1225(b)(2) to Petitioner unlawfully mandates his continued detention and violates 8 C.F.R. \u00a7\u00a7 236.1, 1236.1, and 1003.19.' },
  // Count III
  { id: 'h-c3', type: 'heading', content: 'COUNT III' },
  { id: 'p-c3-sub', type: 'para', content: 'Violation of Fifth Amendment Right to Due Process' },
  { id: 'p-52', type: 'para', content: '52. Petitioner restates and realleges all paragraphs as if fully set forth here.' },
  { id: 'p-53', type: 'para', content: '53. The Fifth Amendment\u2019s Due Process Clause prohibits the federal government from depriving any person of "life, liberty, or property, without due process of law." U.S. Const. Amend. V.' },
  { id: 'p-54', type: 'para', content: '54. The Supreme Court has repeatedly emphasized that the Constitution generally requires a hearing before the government deprives a person of liberty or property. <em>Zinermon v. Burch</em>, 494 U.S. 113, 127 (1990).' },
  { id: 'p-55', type: 'para', content: '55. Under the <em>Mathews v. Eldridge</em> framework, the balance of interests strongly favors Petitioner\u2019s release.' },
  { id: 'p-56', type: 'para', content: '56. Petitioner\u2019s private interest in freedom from detention is profound. The interest in being free from physical detention is "the most elemental of liberty interests." <em>Hamdi v. Rumsfeld</em>, 542 U.S. 507, 529 (2004); see also <em>Zadvydas v. Davis</em>, 533 U.S. 678, 690 (2001) ("Freedom from imprisonment\u2014from government custody, detention, or other forms of physical restraint\u2014lies at the heart of the liberty that [the Due Process] Clause protects.").' },
  { id: 'p-57', type: 'para', content: '57. The risk of erroneous deprivation is exceptionally high. Petitioner {{PETITIONER_CRIMINAL_HISTORY}} and {{PETITIONER_COMMUNITY_TIES}}.' },
  { id: 'p-58', type: 'para', content: '58. The government\u2019s interest in detaining Petitioner without due process is minimal. Immigration detention is civil, not punitive, and may only be used to prevent danger to the community or ensure appearance at immigration proceedings. See <em>Zadvydas</em>, 533 U.S. at 690.' },
  { id: 'p-59', type: 'para', content: '59. Furthermore, the "fiscal and administrative burdens" of providing Petitioner with a bond hearing are minimal, particularly when weighed against the significant liberty interests at stake. See <em>Mathews</em>, 424 U.S. at 334\u201335.' },
  { id: 'p-60', type: 'para', content: '60. Considering these factors, Petitioner respectfully requests that this Court order his immediate release from custody or provide him with a bond hearing.' },
  // Prayer for Relief
  { id: 'h-pray', type: 'heading', content: 'PRAYER FOR RELIEF' },
  { id: 'p-pray', type: 'para', content: 'WHEREFORE, Petitioner prays that this Court will: (1) Assume jurisdiction over this matter; (2) Set this matter for expedited consideration; (3) Order that Petitioner not be transferred outside of this District; (4) Issue an Order to Show Cause ordering Respondents to show cause why this Petition should not be granted within three days; (5) Declare that Petitioner\u2019s detention is unlawful; (6) Issue a Writ of Habeas Corpus ordering Respondents to release Petitioner from custody or provide him with a bond hearing pursuant to 8 U.S.C. \u00a7 1226(a) or the Due Process Clause within seven days; (7) Award Petitioner attorney\u2019s fees and costs under the Equal Access to Justice Act, and on any other basis justified under law; and (8) Grant any further relief this Court deems just and proper.' },
  // Signature
  { id: 'sig-date', type: 'sig', content: 'Date: {{FILING_DATE}}' },
  { id: 'sig-sub', type: 'sig', content: 'Respectfully Submitted,' },
  { id: 'sig-a1', type: 'sig', content: '/s/ {{ATTORNEY1_NAME}}\n{{ATTORNEY1_NAME}}\n{{ATTORNEY1_BAR_NO}}\n{{ATTORNEY1_FIRM}}\n{{ATTORNEY1_ADDRESS}}\n{{ATTORNEY1_CITY_STATE_ZIP}}\n{{ATTORNEY1_PHONE}} \u00b7 {{ATTORNEY1_FAX}}\n{{ATTORNEY1_EMAIL}}' },
  { id: 'sig-a2', type: 'sig', content: '/s/ {{ATTORNEY2_NAME}}\n{{ATTORNEY2_NAME}}\n{{ATTORNEY2_BAR_NO}}*\n{{ATTORNEY2_FIRM}}\n{{ATTORNEY2_ADDRESS}}\n{{ATTORNEY2_CITY_STATE_ZIP}}\n{{ATTORNEY2_PHONE}}\n{{ATTORNEY2_EMAIL}}\n{{ATTORNEY2_PRO_HAC}}' },
  { id: 'sig-role', type: 'sig-label', content: 'Attorneys for Petitioner' },
  // Verification
  { id: 'h-ver', type: 'heading', content: 'VERIFICATION PURSUANT TO 28 U.S.C. \u00a7 2242' },
  { id: 'p-ver', type: 'para', content: 'I represent Petitioner, {{PETITIONER_FULL_NAME}}, and submit this verification on his behalf. I hereby verify that the factual statements made in the foregoing Petition for Writ of Habeas Corpus are true and correct to the best of my knowledge. Dated this {{FILING_DAY}} day of {{FILING_MONTH_YEAR}}.' },
  { id: 'sig-ver', type: 'sig', content: '/s/ {{ATTORNEY2_NAME}}\n{{ATTORNEY2_NAME}}\nAttorney for Petitioner Appearing Pro Hac Vice' },
];

// ── Matrix Event Types ───────────────────────────────────────────
var EVT_NATIONAL = 'com.amino.config.national';
var EVT_FACILITY = 'com.amino.facility';
var EVT_COURT    = 'com.amino.court';
var EVT_ATTORNEY = 'com.amino.attorney';
var EVT_USER     = 'com.amino.user';
var EVT_TEMPLATE = 'com.amino.template';
var EVT_CLIENT   = 'com.amino.client';
var EVT_PETITION = 'com.amino.petition';
var EVT_PETITION_BLOCKS = 'com.amino.petition.blocks';
var EVT_OP       = 'com.amino.op';
var EVT_GITHUB   = 'com.amino.config.github';

// ── Matrix REST Client ───────────────────────────────────────────
var matrix = {
  baseUrl: '', accessToken: '', userId: '', deviceId: '',
  rooms: {},       // roomId -> { stateEvents: { eventType: { stateKey: {content,sender,origin_server_ts} } } }
  orgRoomId: null,
  templatesRoomId: null,
  _txnId: 0,
  _syncToken: null,
  _polling: false,
  _pollAbort: null,
  _flushing: false,

  _headers: function() {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.accessToken,
    };
  },

  _api: function(method, path, body) {
    var opts = { method: method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);
    var controller, timeoutId;
    if (this._flushing) {
      // During page unload flush: use keepalive so browser doesn't cancel the request
      opts.keepalive = true;
    } else {
      // Normal operation: abort fetch after 15 seconds to avoid hanging
      controller = new AbortController();
      timeoutId = setTimeout(function() { controller.abort(); }, 15000);
      opts.signal = controller.signal;
    }
    return fetch(this.baseUrl + '/_matrix/client/v3' + path, opts)
      .then(function(r) {
        // Don't clear timeout yet — keep it active to cover body reads (r.json/r.text).
        // If the body stream stalls, the AbortController will cancel after 15s.
        if (!r.ok) {
          var httpStatus = r.status;
          return r.text().then(function(text) {
            if (timeoutId) clearTimeout(timeoutId);
            try {
              var parsed = JSON.parse(text);
              // Always include HTTP status on error objects
              if (!parsed.status) parsed.status = httpStatus;
              throw parsed;
            } catch(e) {
              if (e instanceof SyntaxError) {
                throw { errcode: 'M_UNKNOWN', error: 'Server returned ' + httpStatus + ' ' + r.statusText, status: httpStatus };
              }
              throw e;
            }
          });
        }
        return r.json().then(function(data) {
          if (timeoutId) clearTimeout(timeoutId);
          return data;
        });
      })
      .catch(function(e) {
        if (timeoutId) clearTimeout(timeoutId);
        if (e && e.errcode) throw e;
        if (e && e.name === 'AbortError') {
          throw { errcode: 'M_NETWORK', error: 'Request timed out', status: 0 };
        }
        throw { errcode: 'M_NETWORK', error: e.message || 'Network error', status: 0 };
      });
  },

  login: function(baseUrl, username, password) {
    this.baseUrl = baseUrl;
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 15000);
    return fetch(baseUrl + '/_matrix/client/v3/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: username },
        password: password,
        initial_device_display_name: 'Amino Habeas App',
      }),
      signal: controller.signal,
    })
    .then(function(r) {
      if (!r.ok) {
        return r.text().then(function(text) {
          clearTimeout(timeoutId);
          try {
            throw JSON.parse(text);
          } catch(e) {
            if (e instanceof SyntaxError) {
              throw { errcode: 'M_UNKNOWN', error: 'Server returned ' + r.status + ' ' + r.statusText, status: r.status };
            }
            if (!e.status) e.status = r.status;
            throw e;
          }
        });
      }
      return r.json();
    })
    .then(function(data) {
      clearTimeout(timeoutId);
      matrix.accessToken = data.access_token;
      matrix.userId = data.user_id;
      matrix.deviceId = data.device_id;
      matrix.saveSession();
      return data;
    })
    .catch(function(e) {
      clearTimeout(timeoutId);
      if (e && e.name === 'AbortError') {
        throw { errcode: 'M_NETWORK', error: 'Request timed out', status: 0 };
      }
      throw e;
    });
  },

  initialSync: function() {
    var filter = JSON.stringify({
      room: {
        state: { lazy_load_members: true },
        timeline: { limit: 0 },
      }
    });
    return this._api('GET', '/sync?timeout=0&filter=' + encodeURIComponent(filter))
      .then(function(data) {
        var joinedRooms = data.rooms && data.rooms.join ? data.rooms.join : {};
        Object.keys(joinedRooms).forEach(function(roomId) {
          var room = joinedRooms[roomId];
          var stateEvents = {};
          var events = (room.state && room.state.events) || [];
          events.forEach(function(evt) {
            if (!stateEvents[evt.type]) stateEvents[evt.type] = {};
            stateEvents[evt.type][evt.state_key] = {
              content: evt.content,
              sender: evt.sender,
              origin_server_ts: evt.origin_server_ts,
            };
          });
          matrix.rooms[roomId] = { stateEvents: stateEvents };
        });
        matrix._syncToken = data.next_batch || null;
        return data;
      });
  },

  resolveAlias: function(alias) {
    return this._api('GET', '/directory/room/' + encodeURIComponent(alias))
      .then(function(data) { return data.room_id; });
  },

  getStateEvents: function(roomId, eventType) {
    var room = this.rooms[roomId];
    if (!room || !room.stateEvents[eventType]) return {};
    return room.stateEvents[eventType];
  },

  getStateEvent: function(roomId, eventType, stateKey) {
    var room = this.rooms[roomId];
    if (!room || !room.stateEvents[eventType]) return null;
    return room.stateEvents[eventType][stateKey] || null;
  },

  sendStateEvent: function(roomId, eventType, content, stateKey) {
    var sk = encodeURIComponent(stateKey);
    var self = this;
    return this._api('PUT', '/rooms/' + encodeURIComponent(roomId) + '/state/' + encodeURIComponent(eventType) + '/' + sk, content)
      .then(function(data) {
        // Update local cache
        if (!self.rooms[roomId]) self.rooms[roomId] = { stateEvents: {} };
        if (!self.rooms[roomId].stateEvents[eventType]) self.rooms[roomId].stateEvents[eventType] = {};
        self.rooms[roomId].stateEvents[eventType][stateKey] = {
          content: content, sender: self.userId, origin_server_ts: Date.now(),
        };
        return data;
      });
  },

  sendEvent: function(roomId, eventType, content) {
    var txnId = 'm' + Date.now() + '.' + (this._txnId++);
    return this._api('PUT', '/rooms/' + encodeURIComponent(roomId) + '/send/' + encodeURIComponent(eventType) + '/' + txnId, content);
  },

  createRoom: function(options) {
    return this._api('POST', '/createRoom', options);
  },

  adminApi: function(method, path, body) {
    var opts = { method: method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(this.baseUrl + '/_synapse/admin' + path, opts)
      .then(function(r) {
        if (!r.ok) {
          return r.text().then(function(text) {
            try { throw JSON.parse(text); }
            catch(e) {
              if (e instanceof SyntaxError) {
                throw { errcode: 'M_UNKNOWN', error: 'Admin API returned ' + r.status, status: r.status };
              }
              if (!e.status) e.status = r.status;
              throw e;
            }
          });
        }
        return r.json();
      })
      .catch(function(e) {
        if (e && e.errcode) throw e;
        throw { errcode: 'M_NETWORK', error: e.message || 'Network error', status: 0 };
      });
  },

  listUsers: function() {
    var self = this;
    var allUsers = [];
    function fetchPage(from) {
      var path = '/v2/users?from=' + from + '&limit=100&guests=false';
      return self.adminApi('GET', path).then(function(data) {
        if (data.users && data.users.length) {
          allUsers = allUsers.concat(data.users);
        }
        if (data.next_token) {
          return fetchPage(parseInt(data.next_token, 10));
        }
        return allUsers;
      });
    }
    return fetchPage(0);
  },

  inviteUser: function(roomId, userId) {
    return this._api('POST', '/rooms/' + encodeURIComponent(roomId) + '/invite', { user_id: userId });
  },

  setPowerLevel: function(roomId, userId, level) {
    var self = this;
    return this._api('GET', '/rooms/' + encodeURIComponent(roomId) + '/state/m.room.power_levels/')
      .then(function(content) {
        if (!content.users) content.users = {};
        content.users[userId] = level;
        return self._api('PUT', '/rooms/' + encodeURIComponent(roomId) + '/state/m.room.power_levels/', content);
      });
  },

  makeRoomAdmin: function(roomId, userId) {
    return this.adminApi('POST', '/v1/rooms/' + encodeURIComponent(roomId) + '/make_room_admin', {
      user_id: userId || this.userId,
    });
  },

  isReady: function() {
    return !!this.accessToken;
  },

  // Verify the stored token is still valid by calling /whoami
  whoami: function() {
    return this._api('GET', '/account/whoami')
      .then(function(data) {
        return data; // { user_id: "@user:server" }
      });
  },

  // Change the current user's password via Matrix UIA flow
  changePassword: function(currentPassword, newPassword) {
    var self = this;
    var username = this.userId ? this.userId.split(':')[0].substring(1) : '';
    // First attempt without auth to get the session ID (UIA flow)
    return this._api('POST', '/account/password', {
      new_password: newPassword,
    }).catch(function(e) {
      // Synapse returns 401 with flows + session for UIA
      if (e && e.status === 401 && e.session) {
        return self._api('POST', '/account/password', {
          new_password: newPassword,
          auth: {
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: username },
            password: currentPassword,
            session: e.session,
          },
        });
      }
      // Some Synapse configs accept auth directly without a 401 first
      if (e && e.status === 401) {
        return self._api('POST', '/account/password', {
          new_password: newPassword,
          auth: {
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: username },
            password: currentPassword,
          },
        });
      }
      throw e;
    });
  },

  saveSession: function() {
    try {
      sessionStorage.setItem('amino_matrix_session', JSON.stringify({
        baseUrl: this.baseUrl, userId: this.userId,
        accessToken: this.accessToken, deviceId: this.deviceId,
      }));
    } catch(e) {}
  },

  loadSession: function() {
    try {
      var raw = sessionStorage.getItem('amino_matrix_session');
      if (!raw) return false;
      var s = JSON.parse(raw);
      this.baseUrl = s.baseUrl;
      this.userId = s.userId;
      this.accessToken = s.accessToken;
      this.deviceId = s.deviceId;
      return true;
    } catch(e) { return false; }
  },

  clearSession: function() {
    sessionStorage.removeItem('amino_matrix_session');
    this.accessToken = '';
    this.userId = '';
    this.rooms = {};
    this.orgRoomId = null;
    this.templatesRoomId = null;
    this._syncToken = null;
    this._polling = false;
    this._pollAbort = null;
  },

  startLongPoll: function() {
    if (this._polling) return;
    if (!this._syncToken) {
      console.warn('Cannot start long-poll: no sync token');
      return;
    }
    this._polling = true;
    this._doPoll();
  },

  stopLongPoll: function() {
    this._polling = false;
    if (this._pollAbort) {
      try { this._pollAbort.abort(); } catch(e) {}
      this._pollAbort = null;
    }
  },

  _doPoll: function() {
    if (!this._polling) return;
    var self = this;
    var filter = JSON.stringify({
      room: {
        state: { lazy_load_members: true },
        timeline: { limit: 50 },
      }
    });
    var url = this.baseUrl + '/_matrix/client/v3/sync?timeout=30000&since='
      + encodeURIComponent(this._syncToken)
      + '&filter=' + encodeURIComponent(filter);

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    this._pollAbort = controller;

    var fetchOpts = { method: 'GET', headers: this._headers() };
    if (controller) fetchOpts.signal = controller.signal;

    fetch(url, fetchOpts)
      .then(function(r) {
        if (!r.ok) {
          return r.text().then(function(text) {
            var err;
            try { err = JSON.parse(text); } catch(e) {
              err = { errcode: 'M_UNKNOWN', error: 'HTTP ' + r.status, status: r.status };
            }
            err.status = r.status;
            throw err;
          });
        }
        return r.json();
      })
      .then(function(data) {
        if (!self._polling) return;
        self._syncToken = data.next_batch || self._syncToken;
        self._processIncrementalSync(data);
        self._doPoll();
      })
      .catch(function(err) {
        if (!self._polling) return;
        if (err && (err.status === 401 || err.status === 403)) {
          console.error('Sync auth failed, stopping poll');
          self._polling = false;
          return;
        }
        console.warn('Long-poll error, retrying in 5s:', err && err.error || err);
        setTimeout(function() { self._doPoll(); }, 5000);
      });
  },

  // Register a new account via the Matrix registration API
  register: function(baseUrl, username, password, email) {
    this.baseUrl = baseUrl;
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 15000);
    return fetch(baseUrl + '/_matrix/client/v3/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth: { type: 'm.login.dummy' },
        username: username,
        password: password,
        initial_device_display_name: 'Amino Habeas App',
      }),
      signal: controller.signal,
    })
    .then(function(r) {
      if (!r.ok) {
        return r.text().then(function(text) {
          clearTimeout(timeoutId);
          try {
            var err = JSON.parse(text);
            if (!err.status) err.status = r.status;
            throw err;
          } catch(e) {
            if (e instanceof SyntaxError) {
              throw { errcode: 'M_UNKNOWN', error: 'Server returned ' + r.status + ' ' + r.statusText, status: r.status };
            }
            throw e;
          }
        });
      }
      return r.json();
    })
    .then(function(data) {
      clearTimeout(timeoutId);
      matrix.accessToken = data.access_token;
      matrix.userId = data.user_id;
      matrix.deviceId = data.device_id;
      matrix.saveSession();
      return data;
    })
    .catch(function(e) {
      clearTimeout(timeoutId);
      if (e && e.name === 'AbortError') {
        throw { errcode: 'M_NETWORK', error: 'Request timed out', status: 0 };
      }
      throw e;
    });
  },

  _processIncrementalSync: function(data) {
    var joinedRooms = data.rooms && data.rooms.join ? data.rooms.join : {};
    var changed = false;
    var self = this;

    Object.keys(joinedRooms).forEach(function(roomId) {
      var room = joinedRooms[roomId];
      var events = [];
      if (room.state && room.state.events) {
        events = events.concat(room.state.events);
      }
      if (room.timeline && room.timeline.events) {
        room.timeline.events.forEach(function(evt) {
          if (evt.state_key !== undefined && evt.state_key !== null) {
            events.push(evt);
          }
        });
      }
      if (events.length === 0) return;

      if (!self.rooms[roomId]) {
        self.rooms[roomId] = { stateEvents: {} };
      }

      events.forEach(function(evt) {
        if (!self.rooms[roomId].stateEvents[evt.type]) {
          self.rooms[roomId].stateEvents[evt.type] = {};
        }
        var existing = self.rooms[roomId].stateEvents[evt.type][evt.state_key];
        self.rooms[roomId].stateEvents[evt.type][evt.state_key] = {
          content: evt.content,
          sender: evt.sender,
          origin_server_ts: evt.origin_server_ts,
        };
        // Trigger hydrateFromMatrix for non-self events or newly appearing state keys
        if (evt.sender !== self.userId || !existing) {
          changed = true;
        }
      });
    });

    if (changed) {
      hydrateFromMatrix();
    }
  },
};

// ── App State ────────────────────────────────────────────────────
var S = {
  authenticated: false,
  loading: true,
  syncError: '',
  facilities: {},
  courts: {},
  attProfiles: {},
  national: { iceDirector: '', iceDirectorTitle: '', dhsSecretary: '', attorneyGeneral: '' },
  clients: {},
  petitions: {},
  users: {},
  serverUsersLoaded: false,
  serverUsersError: '',
  log: [],
  role: null,
  isSynapseAdmin: false,
  adminEditUserId: null,
  adminDraft: {},
  currentUser: '',
  currentView: 'board',
  selectedClientId: null,
  selectedPetitionId: null,
  editorTab: 'client',
  dirTab: 'facilities',
  editId: null,
  draft: {},
  inlineAdd: null,
  boardMode: 'kanban',
  boardTableGroup: 'stage',
  boardAddingMatter: false,
  boardShowAllFiled: false,
  boardShowArchived: false,
  dirShowArchived: false,
  clientsShowArchived: false,
  _rendering: false,
  // Password change modal state
  showPasswordChange: false,
  passwordChangeDraft: { currentPassword: '', newPassword: '', confirmPassword: '' },
  passwordChangeError: '',
  passwordChangeBusy: false,
  // Forced password change on first login (admin-created users)
  mustChangePassword: false,
  // Deployment management (admin only)
  adminTab: 'users',
  deployInfo: typeof DEPLOY_INFO !== 'undefined' ? DEPLOY_INFO : null,
  deployHistory: [],
  deployHistoryLoaded: false,
  deployHistoryError: '',
  deployRollbackBusy: false,
  deployDeployBusy: false,
  deployGithubToken: sessionStorage.getItem('amino_gh_token') || '',
  deployTokenSet: !!sessionStorage.getItem('amino_gh_token'),
  // Review gate — admin must review before deploying
  deployReviewState: 'none', // 'none' | 'loading' | 'reviewing' | 'approved'
  deployDiffFiles: [],       // [{filename, status, additions, deletions}]
  deployDiffStats: null,     // {total_commits, files_changed, additions, deletions}
  deployDiffError: '',
  deployDiffBaseSha: '',     // production SHA we diff against
  deployDiffHeadSha: '',     // main HEAD SHA
};

var _collapsedGroups = {};
var _wasDragged = false;
var _prevView = null;
function setState(updates) {
  Object.assign(S, updates);
  if (!S._rendering) {
    S._rendering = true;
    requestAnimationFrame(function() {
      S._rendering = false;
      render();
    });
  }
}

// ── Room discovery from synced data ──────────────────────────────
function discoverRoomByAlias(alias) {
  var roomIds = Object.keys(matrix.rooms);
  // Extract the local part from the alias (e.g., "#org:server" -> "org")
  var localPart = alias.replace(/^#/, '').split(':')[0];
  for (var i = 0; i < roomIds.length; i++) {
    var roomId = roomIds[i];
    var room = matrix.rooms[roomId];
    if (!room || !room.stateEvents) continue;
    // Check m.room.canonical_alias
    var canonical = room.stateEvents['m.room.canonical_alias'];
    if (canonical && canonical[''] && canonical[''].content) {
      if (canonical[''].content.alias === alias) return roomId;
      var alts = canonical[''].content.alt_aliases || [];
      if (alts.indexOf(alias) >= 0) return roomId;
    }
    // Fallback: check m.room.name (e.g., room named "Amino Org" for #org)
    var nameEvt = room.stateEvents['m.room.name'];
    if (nameEvt && nameEvt[''] && nameEvt[''].content && nameEvt[''].content.name) {
      var rname = nameEvt[''].content.name.toLowerCase();
      if (localPart === 'org' && (rname === 'amino org' || rname === 'org')) return roomId;
      if (localPart === 'templates' && (rname === 'templates' || rname === 'amino templates')) return roomId;
    }
  }
  return null;
}

// ── Room auto-creation ───────────────────────────────────────────
function ensureRoom(alias, name) {
  // 1. Check synced data
  var id = discoverRoomByAlias(alias);
  if (id) return Promise.resolve(id);
  // 2. Try alias resolution API
  return matrix.resolveAlias(alias)
    .catch(function() {
      // 3. Room not found — create it
      var localAlias = alias.replace(/^#/, '').split(':')[0];
      return matrix.createRoom({
        name: name,
        room_alias_name: localAlias,
        visibility: 'private',
        preset: 'private_chat',
      }).then(function(data) {
        // Cache the new room locally so getStateEvents works immediately
        if (!matrix.rooms[data.room_id]) {
          matrix.rooms[data.room_id] = { stateEvents: {} };
        }
        return data.room_id;
      }).catch(function(createErr) {
        // If alias already taken (race condition), try resolving again
        if (createErr && createErr.errcode === 'M_ROOM_IN_USE') {
          return matrix.resolveAlias(alias).catch(function() { return null; });
        }
        // If alias creation is restricted, try creating without alias
        if (createErr && (createErr.errcode === 'M_UNKNOWN' || createErr.errcode === 'M_FORBIDDEN')) {
          return matrix.createRoom({
            name: name,
            visibility: 'private',
            preset: 'private_chat',
          }).then(function(data) {
            if (!matrix.rooms[data.room_id]) {
              matrix.rooms[data.room_id] = { stateEvents: {} };
            }
            return data.room_id;
          }).catch(function() { return null; });
        }
        console.warn('Could not create room ' + alias + ':', createErr);
        return null;
      });
    });
}

// ── Merge server users with managed users ────────────────────────
function mergeServerUsers(serverUsers) {
  var userEvents = matrix.getStateEvents(matrix.orgRoomId, EVT_USER);
  var merged = {};

  // EVT_USER managed users first
  Object.keys(userEvents).forEach(function(k) {
    var e = userEvents[k];
    if (k && e.content && !e.content.deleted) {
      merged[k] = {
        mxid: k,
        displayName: e.content.displayName || k.replace(/@(.+):.*/, '$1'),
        role: e.content.role || 'attorney',
        active: e.content.active !== false,
        managed: true,
        createdBy: e.sender,
        updatedAt: new Date(e.origin_server_ts).toISOString(),
      };
    }
  });

  // Overlay server user data
  serverUsers.forEach(function(su) {
    var mxid = su.name;
    if (merged[mxid]) {
      merged[mxid].synapseAdmin = !!su.admin;
      merged[mxid].deactivated = !!su.deactivated;
      merged[mxid].creationTs = su.creation_ts;
      if (su.deactivated) merged[mxid].active = false;
    } else {
      merged[mxid] = {
        mxid: mxid,
        displayName: su.displayname || mxid.replace(/@(.+):.*/, '$1'),
        role: null,
        active: !su.deactivated,
        managed: false,
        synapseAdmin: !!su.admin,
        deactivated: !!su.deactivated,
        creationTs: su.creation_ts,
        createdBy: null,
        updatedAt: su.creation_ts ? new Date(su.creation_ts * 1000).toISOString() : null,
      };
    }
  });

  return merged;
}

// ── Admin Auto-Invite Helpers ────────────────────────────────────
function getAdminMxids() {
  var admins = [];
  Object.keys(S.users).forEach(function(mxid) {
    if (S.users[mxid].role === 'admin' && S.users[mxid].active !== false && mxid !== matrix.userId) {
      admins.push(mxid);
    }
  });
  return admins;
}

function inviteAdminsToRoom(roomId) {
  var admins = getAdminMxids();
  admins.forEach(function(mxid) {
    matrix.inviteUser(roomId, mxid)
      .then(function() {
        return matrix.setPowerLevel(roomId, mxid, 50);
      })
      .catch(function(e) {
        console.warn('Failed to invite/set PL for admin', mxid, 'in room', roomId, e);
      });
  });
}

// ── Hydration from Matrix ────────────────────────────────────────
function hydrateFromMatrix() {
  // Discover or auto-create org and templates rooms
  var orgPromise = ensureRoom(CONFIG.ORG_ROOM_ALIAS, 'Amino Org');
  var tmplPromise = ensureRoom(CONFIG.TEMPLATES_ROOM_ALIAS, 'Templates');

  return orgPromise
    .then(function(resolvedOrgId) {
      matrix.orgRoomId = resolvedOrgId;
      return tmplPromise;
    })
    .then(function(resolvedTmplId) {
      matrix.templatesRoomId = resolvedTmplId;

      // Facilities
      var facEvents = matrix.getStateEvents(matrix.orgRoomId, EVT_FACILITY);
      var facilities = {};
      Object.keys(facEvents).forEach(function(k) {
        var e = facEvents[k];
        if (k && e.content && e.content.name && !e.content.deleted) {
          facilities[k] = Object.assign({ id: k, createdBy: e.sender, updatedAt: new Date(e.origin_server_ts).toISOString() }, e.content);
        }
      });

      // Seed all ICE facilities so they are available in the directory for all users.
      // Only adds seeds that haven't already been saved (or deleted) in Matrix.
      ICE_FACILITY_SEEDS.forEach(function(seed) {
        var seedId = 'seed-' + seed.n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        // Skip if this facility already exists in Matrix (active or deleted)
        if (facEvents[seedId]) return;
        facilities[seedId] = {
          id: seedId,
          name: seed.n,
          city: seed.c,
          state: stateAbbrToName(seed.s),
          warden: '',
          fieldOfficeName: seed.fo,
          fieldOfficeDirector: '',
          createdBy: 'system',
          updatedAt: new Date().toISOString(),
          seeded: true
        };
      });

      // Courts
      var crtEvents = matrix.getStateEvents(matrix.orgRoomId, EVT_COURT);
      var courts = {};
      Object.keys(crtEvents).forEach(function(k) {
        var e = crtEvents[k];
        if (k && e.content && e.content.district && !e.content.deleted) {
          courts[k] = Object.assign({ id: k, createdBy: e.sender, updatedAt: new Date(e.origin_server_ts).toISOString() }, e.content);
        }
      });

      // Seed all federal district courts so they are available in the directory for all users.
      // Only adds seeds that haven't already been saved (or deleted) in Matrix.
      COURT_SEEDS.forEach(function(seed) {
        var seedId = 'seed-' + seed.d.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        // Skip if this court already exists in Matrix (active or deleted)
        if (crtEvents[seedId]) return;
        courts[seedId] = {
          id: seedId,
          district: seed.d,
          division: '',
          circuit: seed.ci,
          ecfUrl: seed.e,
          pacerUrl: seed.p,
          createdBy: 'system',
          updatedAt: new Date().toISOString(),
          seeded: true
        };
      });

      // Attorney profiles
      var attEvents = matrix.getStateEvents(matrix.orgRoomId, EVT_ATTORNEY);
      var attProfiles = {};
      Object.keys(attEvents).forEach(function(k) {
        var e = attEvents[k];
        if (k && e.content && e.content.name && !e.content.deleted) {
          attProfiles[k] = Object.assign({ id: k, createdBy: e.sender, updatedAt: new Date(e.origin_server_ts).toISOString() }, e.content);
        }
      });

      // National defaults
      var natEvt = matrix.getStateEvent(matrix.orgRoomId, EVT_NATIONAL, '');
      var national = { iceDirector: '', iceDirectorTitle: '', dhsSecretary: '', attorneyGeneral: '' };
      if (natEvt && natEvt.content) {
        national = {
          iceDirector: natEvt.content.iceDirector || '',
          iceDirectorTitle: natEvt.content.iceDirectorTitle || '',
          dhsSecretary: natEvt.content.dhsSecretary || '',
          attorneyGeneral: natEvt.content.attorneyGeneral || '',
          createdBy: natEvt.sender,
          updatedAt: new Date(natEvt.origin_server_ts).toISOString(),
        };
      }

      // GitHub PAT (stored in org room for persistence across sessions)
      var ghEvt = matrix.getStateEvent(matrix.orgRoomId, EVT_GITHUB, '');
      if (ghEvt && ghEvt.content && ghEvt.content.pat) {
        S.deployGithubToken = ghEvt.content.pat;
        S.deployTokenSet = true;
        sessionStorage.setItem('amino_gh_token', ghEvt.content.pat);
      }

      // Users
      var userEvents = matrix.getStateEvents(matrix.orgRoomId, EVT_USER);
      var users = {};
      var mustChangePassword = false;
      Object.keys(userEvents).forEach(function(k) {
        var e = userEvents[k];
        if (k && e.content && !e.content.deleted) {
          users[k] = {
            mxid: k,
            displayName: e.content.displayName || k.replace(/@(.+):.*/, '$1'),
            role: e.content.role || 'attorney',
            email: e.content.email || '',
            active: e.content.active !== false,
            createdBy: e.sender,
            updatedAt: new Date(e.origin_server_ts).toISOString(),
          };
          // Check if the current user must change their password
          if (k === matrix.userId && e.content.mustChangePassword) {
            mustChangePassword = true;
          }
        }
      });

      // Client rooms + petitions
      var clients = {};
      var petitions = {};
      Object.keys(matrix.rooms).forEach(function(roomId) {
        var clientEvt = matrix.getStateEvent(roomId, EVT_CLIENT, '');
        if (!clientEvt || !clientEvt.content || clientEvt.content.deleted) return;
        var cc = clientEvt.content;
        var cid = cc.id || roomId;
        clients[cid] = {
          id: cid, name: cc.name || '', country: cc.country || '',
          yearsInUS: cc.yearsInUS || '', entryDate: cc.entryDate || '',
          entryMethod: cc.entryMethod || 'without inspection',
          apprehensionLocation: cc.apprehensionLocation || '',
          apprehensionDate: cc.apprehensionDate || '',
          criminalHistory: cc.criminalHistory || '',
          communityTies: cc.communityTies || '',
          archived: !!cc.archived,
          createdAt: new Date(clientEvt.origin_server_ts).toISOString(),
          roomId: roomId,
        };

        // Petitions in this room
        var petEvents = matrix.getStateEvents(roomId, EVT_PETITION);
        Object.keys(petEvents).forEach(function(petId) {
          var pe = petEvents[petId];
          if (!petId || !pe.content || pe.content.deleted) return;
          var pc = pe.content;
          var blocksEvt = matrix.getStateEvent(roomId, EVT_PETITION_BLOCKS, petId);
          var blocks = (blocksEvt && blocksEvt.content && blocksEvt.content.blocks) || [];
          petitions[petId] = {
            id: petId, clientId: pc.clientId || cid, createdBy: pc.createdBy || pe.sender || '',
            stage: migrateStage(pc.stage || 'intake'),
            stageHistory: pc.stageHistory || [{ stage: migrateStage(pc.stage || 'intake'), at: new Date(pe.origin_server_ts).toISOString() }],
            _bodyEdited: !!pc._bodyEdited,
            _exported: !!pc._exported,
            blocks: blocks,
            district: pc.district || '', division: pc.division || '', courtWebsite: pc.courtWebsite || '',
            caseNumber: pc.caseNumber || '',
            facilityName: pc.facilityName || '', facilityCity: pc.facilityCity || '',
            facilityState: pc.facilityState || '', warden: pc.warden || '',
            fieldOfficeDirector: pc.fieldOfficeDirector || '',
            fieldOfficeName: pc.fieldOfficeName || '',
            natIceDirector: pc.natIceDirector || '', natIceDirectorTitle: pc.natIceDirectorTitle || '',
            natDhsSecretary: pc.natDhsSecretary || '', natAttorneyGeneral: pc.natAttorneyGeneral || '',
            filingDate: pc.filingDate || '', filingDay: pc.filingDay || '',
            filingMonthYear: pc.filingMonthYear || '',
            templateId: pc.templateId, att1Id: pc.att1Id, att2Id: pc.att2Id,
            _facilityId: pc._facilityId, _courtId: pc._courtId,
            _att1Id: pc._att1Id, _att2Id: pc._att2Id,
            pageSettings: pc.pageSettings || Object.assign({}, DEFAULT_PAGE_SETTINGS),
            archived: !!pc.archived,
            createdAt: new Date(pe.origin_server_ts).toISOString(),
            roomId: roomId,
          };
        });
      });

      // Role — determine from power levels in !org room
      var role = 'attorney';
      var myPl = 0;
      if (matrix.orgRoomId) {
        var plEvt = matrix.getStateEvent(matrix.orgRoomId, 'm.room.power_levels', '');
        if (plEvt && plEvt.content && plEvt.content.users) {
          myPl = plEvt.content.users[matrix.userId] || 0;
          if (myPl >= 50) role = 'admin';
        }
      }

      var syncError = '';
      if (!matrix.orgRoomId) {
        syncError = 'Could not connect to the organization room. Directory data may be unavailable. Check that the Matrix server is running.';
      }

      setState({
        facilities: facilities, courts: courts, attProfiles: attProfiles,
        national: national, clients: clients, petitions: petitions,
        users: users, role: role, currentUser: matrix.userId, syncError: syncError,
        mustChangePassword: mustChangePassword,
      });

      // Check if current user is a Synapse server admin by trying listUsers.
      // If they are, auto-promote to PL 100 in org/templates rooms via make_room_admin.
      matrix.listUsers()
        .then(function(serverUsers) {
          // listUsers succeeded — user IS a Synapse server admin
          setState({ isSynapseAdmin: true });

          // Auto-promote to room admin if PL < 100
          var promoteChain = Promise.resolve();
          if (matrix.orgRoomId && myPl < 100) {
            promoteChain = matrix.makeRoomAdmin(matrix.orgRoomId)
              .then(function() {
                console.log('[amino] Auto-promoted to room admin in !org');
              })
              .catch(function(e) {
                console.warn('[amino] make_room_admin failed for org room:', e);
              });
          }
          if (matrix.templatesRoomId) {
            promoteChain = promoteChain.then(function() {
              return matrix.makeRoomAdmin(matrix.templatesRoomId)
                .then(function() {
                  console.log('[amino] Auto-promoted to room admin in !templates');
                })
                .catch(function(e) {
                  console.warn('[amino] make_room_admin failed for templates room:', e);
                });
            });
          }

          return promoteChain.then(function() {
            // After promotion, ensure role is admin
            if (role !== 'admin') {
              role = 'admin';
              setState({ role: 'admin' });
            }
            setState({ users: mergeServerUsers(serverUsers), serverUsersLoaded: true, serverUsersError: '' });
          });
        })
        .catch(function(err) {
          // listUsers failed — not a Synapse server admin (or network error)
          if (role === 'admin') {
            // User has room PL >= 50 but is not a Synapse admin — show server users error
            var msg = '';
            if (err && err.status === 403) {
              msg = 'Cannot list server users: your account lacks Synapse server admin privileges.';
            } else {
              msg = 'Could not fetch server user list: ' + ((err && err.error) || 'unknown error');
            }
            setState({ serverUsersLoaded: true, serverUsersError: msg });
          }
        });
    });
}

// ── Export Functions ─────────────────────────────────────────────
var TITLE_IDS = { 'ct-1': 1, 'ct-2': 1, 'ct-3': 1 };
var CAP_L = ['cap-pet','cap-role','cap-v','cap-r1','cap-r2','cap-r3','cap-r4','cap-r5','cap-r6'];
var CAP_R = ['cap-case','cap-title'];
var CAP_ALL = {};
Object.keys(TITLE_IDS).forEach(function(k) { CAP_ALL[k] = 1; });
CAP_L.forEach(function(k) { CAP_ALL[k] = 1; });
CAP_R.forEach(function(k) { CAP_ALL[k] = 1; });

function subVars(s, vars) {
  return s.replace(/\{\{(\w+)\}\}/g, function(_, k) {
    return (vars[k] && vars[k].trim()) ? vars[k] : '[' + k + ']';
  });
}
function capSub(s, vars) {
  return subVars(s, vars).replace(/\n/g, '<br>');
}

// ── DOCX Export (proper .docx via docx library) ─────────────────
function parseDocxRuns(content, vars, extraProps) {
  extraProps = extraProps || {};
  var text = subVars(content, vars);
  var segments = [];
  var re = /<em>([\s\S]*?)<\/em>/g;
  var lastIndex = 0;
  var match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), italic: false });
    }
    segments.push({ text: match[1], italic: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), italic: false });
  }
  if (segments.length === 0) {
    segments.push({ text: text, italic: false });
  }
  var runs = [];
  segments.forEach(function(seg) {
    var props = { text: seg.text, font: 'Times New Roman', size: 24 };
    if (seg.italic) props.italics = true;
    Object.keys(extraProps).forEach(function(k) { props[k] = extraProps[k]; });
    runs.push(new docx.TextRun(props));
  });
  return runs;
}

function makeDocxLinesRuns(text, extraProps) {
  extraProps = extraProps || {};
  var lines = text.split('\n');
  var runs = [];
  lines.forEach(function(line, i) {
    if (i > 0) runs.push(new docx.TextRun(Object.assign({ break: 1, font: 'Times New Roman', size: 24 }, extraProps)));
    runs.push(new docx.TextRun(Object.assign({ text: line, font: 'Times New Roman', size: 24 }, extraProps)));
  });
  return runs;
}

function buildDocxDocument(blocks, vars) {
  var noBorder = { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  var borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  var defaultSpacing = { line: 324 }; // 1.35x line height (240 * 1.35)

  var titleBlocks = blocks.filter(function(b) { return TITLE_IDS[b.id]; });
  var capLeftBlocks = blocks.filter(function(b) { return CAP_L.indexOf(b.id) >= 0; });
  var capRightBlocks = blocks.filter(function(b) { return CAP_R.indexOf(b.id) >= 0; });
  var bodyBlocks = blocks.filter(function(b) { return !CAP_ALL[b.id]; });

  var children = [];

  // Title paragraphs (centered, bold)
  titleBlocks.forEach(function(b) {
    children.push(new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      spacing: Object.assign({ after: 0 }, defaultSpacing),
      children: parseDocxRuns(b.content, vars, { bold: true }),
    }));
  });

  // Spacer before caption
  children.push(new docx.Paragraph({ spacing: { after: 200 }, children: [] }));

  // Caption table (3 columns: left 55%, middle 5% parens, right 40%)
  var leftChildren = [];
  capLeftBlocks.forEach(function(b) {
    var alignment, extra = {};
    if (b.type === 'cap-name') { alignment = docx.AlignmentType.CENTER; extra.bold = true; }
    else if (b.type === 'cap-center') { alignment = docx.AlignmentType.CENTER; }
    else { alignment = docx.AlignmentType.LEFT; }
    var text = subVars(b.content, vars);
    leftChildren.push(new docx.Paragraph({
      alignment: alignment,
      spacing: b.type === 'cap-center' ? { before: 100, after: 100 } : { after: 80 },
      children: makeDocxLinesRuns(text, extra),
    }));
  });

  var parenRuns = [];
  for (var pi = 0; pi < 24; pi++) {
    if (pi > 0) parenRuns.push(new docx.TextRun({ break: 1, font: 'Times New Roman', size: 24 }));
    parenRuns.push(new docx.TextRun({ text: ')', font: 'Times New Roman', size: 24 }));
  }

  var rightChildren = [];
  capRightBlocks.forEach(function(b) {
    if (b.type === 'cap-case') {
      rightChildren.push(new docx.Paragraph({
        spacing: { after: 280 },
        children: parseDocxRuns(b.content, vars),
      }));
    } else {
      // cap-doctitle: bold
      rightChildren.push(new docx.Paragraph({
        spacing: { after: 0 },
        children: parseDocxRuns(b.content, vars, { bold: true }),
      }));
    }
  });

  children.push(new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: [
      new docx.TableRow({
        children: [
          new docx.TableCell({
            width: { size: 55, type: docx.WidthType.PERCENTAGE },
            borders: borders,
            children: leftChildren,
          }),
          new docx.TableCell({
            width: { size: 5, type: docx.WidthType.PERCENTAGE },
            borders: borders,
            verticalAlign: docx.VerticalAlign.TOP,
            children: [new docx.Paragraph({
              alignment: docx.AlignmentType.CENTER,
              children: parenRuns,
            })],
          }),
          new docx.TableCell({
            width: { size: 40, type: docx.WidthType.PERCENTAGE },
            borders: borders,
            verticalAlign: docx.VerticalAlign.CENTER,
            children: rightChildren,
          }),
        ],
      }),
    ],
  }));

  // Spacer after caption
  children.push(new docx.Paragraph({ spacing: { after: 200 }, children: [] }));

  // Body blocks
  bodyBlocks.forEach(function(b) {
    if (b.type === 'heading') {
      var hText = subVars(b.content, vars).toUpperCase();
      children.push(new docx.Paragraph({
        spacing: Object.assign({ before: 360, after: 120 }, defaultSpacing),
        children: [new docx.TextRun({ text: hText, bold: true, font: 'Times New Roman', size: 24 })],
      }));
    } else if (b.type === 'sig') {
      var sigText = subVars(b.content, vars);
      children.push(new docx.Paragraph({
        spacing: Object.assign({ after: 200 }, defaultSpacing),
        children: makeDocxLinesRuns(sigText),
      }));
    } else if (b.type === 'sig-label') {
      children.push(new docx.Paragraph({
        spacing: Object.assign({ after: 200 }, defaultSpacing),
        children: parseDocxRuns(b.content, vars, { italics: true }),
      }));
    } else {
      // para (default)
      children.push(new docx.Paragraph({
        alignment: docx.AlignmentType.BOTH,
        spacing: Object.assign({ after: 200 }, defaultSpacing),
        children: parseDocxRuns(b.content, vars),
      }));
    }
  });

  return new docx.Document({
    sections: [{
      properties: {
        page: {
          size: {
            orientation: docx.PageOrientation.PORTRAIT,
            width: docx.convertInchesToTwip(8.5),
            height: docx.convertInchesToTwip(11),
          },
          margin: {
            top: docx.convertInchesToTwip(1),
            bottom: docx.convertInchesToTwip(1),
            left: docx.convertInchesToTwip(1),
            right: docx.convertInchesToTwip(1),
          },
        },
      },
      children: children,
    }],
  });
}

function doExportDocx(blocks, vars, name) {
  try {
    var doc = buildDocxDocument(blocks, vars);
    docx.Packer.toBlob(doc).then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'habeas-' + (name || 'matter').replace(/\s+/g, '-').toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.docx';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }).catch(function(err) {
      console.error('DOCX packing failed, falling back to HTML .doc:', err);
      doExportDoc(blocks, vars, name);
    });
  } catch (err) {
    console.error('DOCX build failed, falling back to HTML .doc:', err);
    doExportDoc(blocks, vars, name);
  }
}

function buildDocHTML(blocks, vars, pageSettings) {
  var ps = pageSettings || DEFAULT_PAGE_SETTINGS;
  var caseNo = (vars.CASE_NUMBER && vars.CASE_NUMBER.trim()) ? 'C/A No. ' + vars.CASE_NUMBER : '';
  function resolveExportVar(text) {
    if (!text) return '';
    return text
      .replace(/\{\{PAGE\}\}/g, '')  // Page numbers not available in single-flow HTML export
      .replace(/\{\{PAGE_NUM\}\}/g, '')
      .replace(/\{\{TOTAL_PAGES\}\}/g, '')
      .replace(/\{\{CASE_NUMBER\}\}/g, caseNo);
  }
  var titles = blocks.filter(function(b) { return TITLE_IDS[b.id]; })
    .map(function(b) { return '<div class="title">' + capSub(b.content, vars) + '</div>'; }).join('');
  var capLeft = blocks.filter(function(b) { return CAP_L.indexOf(b.id) >= 0; })
    .map(function(b) {
      var cls = b.type === 'cap-name' ? 'cn' : b.type === 'cap-center' ? 'cc' : 'rr';
      return '<div class="' + cls + '">' + capSub(b.content, vars) + '</div>';
    }).join('');
  var capRight = blocks.filter(function(b) { return CAP_R.indexOf(b.id) >= 0; })
    .map(function(b) {
      var cls = b.type === 'cap-case' ? 'ck' : 'cd';
      return '<div class="' + cls + '">' + capSub(b.content, vars) + '</div>';
    }).join('');
  var body = blocks.filter(function(b) { return !CAP_ALL[b.id]; })
    .map(function(b) {
      var cls = b.type === 'heading' ? 'heading' : b.type === 'sig' ? 'sig' : b.type === 'sig-label' ? 'sig-label' : 'para';
      var text = b.type === 'heading' ? capSub(b.content, vars).toUpperCase() : capSub(b.content, vars);
      return '<div class="' + cls + '">' + text + '</div>';
    }).join('');
  var parens = Array(24).fill(')').join('<br>');
  var hasHeader = ps.headerLeft || ps.headerCenter || ps.headerRight;
  var hasFooter = ps.footerLeft || ps.footerCenter || ps.footerRight;
  var hfCss = '.doc-hf{display:flex;justify-content:space-between;font-size:9pt;color:#666}.doc-hf span{flex:1}.doc-hf span:nth-child(2){text-align:center}.doc-hf span:last-child{text-align:right}.doc-hdr{margin-bottom:12pt}.doc-ftr{margin-top:24pt}';
  var headerHtml = hasHeader ? '<div class="doc-hf doc-hdr"><span>' + resolveExportVar(ps.headerLeft) + '</span><span>' + resolveExportVar(ps.headerCenter) + '</span><span>' + resolveExportVar(ps.headerRight) + '</span></div>' : '';
  var footerHtml = hasFooter ? '<div class="doc-hf doc-ftr"><span>' + resolveExportVar(ps.footerLeft) + '</span><span>' + resolveExportVar(ps.footerCenter) + '</span><span>' + resolveExportVar(ps.footerRight) + '</span></div>' : '';
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head>' +
    '<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>' +
    '<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->' +
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
    '<style>@page WordSection1{size:8.5in 11in;margin:1in;mso-header-margin:.5in;mso-footer-margin:.5in;mso-paper-source:0}div.WordSection1{page:WordSection1}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.35}.title{text-align:center;font-weight:bold;margin:0}.heading{font-weight:bold;text-transform:uppercase;margin:18pt 0 6pt}.para{margin:0 0 10pt;text-align:justify}.sig{white-space:pre-line;margin:0 0 10pt}.sig-label{font-style:italic}table.c{width:100%;border-collapse:collapse;margin:18pt 0}table.c td{vertical-align:top;padding:0 4pt}.cl{width:55%}.cm{width:5%;text-align:center}.cr{width:40%}.cn{text-align:center;font-weight:bold}.cc{text-align:center;margin:10pt 0}.rr{margin:0 0 8pt}.ck{margin:0 0 12pt}.cd{font-weight:bold}' + hfCss + '</style></head><body><div class="WordSection1">' + headerHtml + titles + '<table class="c"><tr><td class="cl">' + capLeft + '</td><td class="cm">' + parens + '</td><td class="cr">' + capRight + '</td></tr></table>' + body + footerHtml + '</div></body></html>';
}

function doExportDoc(blocks, vars, name, pageSettings) {
  var html = buildDocHTML(blocks, vars, pageSettings);
  var blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'habeas-' + (name || 'matter').replace(/\s+/g, '-').toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.doc';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function doExportPDF(blocks, vars, pageSettings) {
  var w = window.open('', '_blank', 'width=850,height=1100');
  if (!w) { alert('Allow popups for PDF export'); return; }
  w.document.write(buildDocHTML(blocks, vars, pageSettings));
  w.document.close();
  setTimeout(function() { w.focus(); w.print(); }, 500);
}

// ── CSV Export Functions ────────────────────────────────────────
function csvEscape(val) {
  if (val == null) return '';
  var s = String(val);
  if (s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCSV(headers, rows) {
  var lines = [headers.map(csvEscape).join(',')];
  rows.forEach(function(row) {
    lines.push(row.map(csvEscape).join(','));
  });
  return lines.join('\r\n');
}

function downloadCSV(csvString, filename) {
  var blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function exportPetitionsCSV() {
  var all = Object.values(S.petitions).filter(function(p) { return !p.archived; });
  var vis = S.role === 'admin' ? all : all.filter(function(p) { return p.createdBy === S.currentUser; });
  vis.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  var headers = ['Client Name', 'Case Number', 'Stage', 'Readiness %', 'District', 'Division',
    'Facility', 'Facility City', 'Facility State', 'Warden',
    'Field Office', 'Field Office Director', 'Attorney 1', 'Attorney 2',
    'Filing Date', 'Created By', 'Created At', 'Time in Stage'];

  var rows = vis.map(function(p) {
    var cl = S.clients[p.clientId];
    var a1 = p._att1Id ? S.attProfiles[p._att1Id] : null;
    var a2 = p._att2Id ? S.attProfiles[p._att2Id] : null;
    var creator = S.users[p.createdBy] ? S.users[p.createdBy].displayName : p.createdBy;
    var rdns = computeReadiness(p, cl || {});
    return [
      cl ? cl.name || '' : '',
      p.caseNumber || '',
      (SM[p.stage] ? SM[p.stage].label : p.stage) || '',
      Math.round(rdns.score * 100) + '%',
      p.district || '',
      p.division || '',
      p.facilityName || '',
      p.facilityCity || '',
      p.facilityState || '',
      p.warden || '',
      p.fieldOfficeName || '',
      p.fieldOfficeDirector || '',
      a1 ? a1.name || '' : '',
      a2 ? a2.name || '' : '',
      p.filingDate || '',
      creator || '',
      p.createdAt || '',
      timeInStage(p)
    ];
  });

  var dateSlice = new Date().toISOString().slice(0, 10);
  downloadCSV(buildCSV(headers, rows), 'petitions-' + dateSlice + '.csv');
}

function exportClientsCSV() {
  var allClients = Object.values(S.clients).filter(function(c) { return !c.archived; });
  var clientList;
  if (S.role === 'admin') {
    clientList = allClients;
  } else {
    var myClientIds = {};
    Object.values(S.petitions).forEach(function(p) {
      if (p.createdBy === S.currentUser) myClientIds[p.clientId] = true;
    });
    clientList = allClients.filter(function(c) { return myClientIds[c.id]; });
  }
  clientList.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });

  var headers = ['Name', 'Country', 'Years in US', 'Entry Date', 'Entry Method',
    'Arrest Location', 'Arrest Date', 'Criminal History', 'Community Ties',
    'Petition Count', 'Created At'];

  var rows = clientList.map(function(c) {
    var petCount = Object.values(S.petitions).filter(function(p) { return p.clientId === c.id; }).length;
    return [
      c.name || '',
      c.country || '',
      c.yearsInUS || '',
      c.entryDate || '',
      c.entryMethod || '',
      c.apprehensionLocation || '',
      c.apprehensionDate || '',
      c.criminalHistory || '',
      c.communityTies || '',
      petCount,
      c.createdAt || ''
    ];
  });

  var dateSlice = new Date().toISOString().slice(0, 10);
  downloadCSV(buildCSV(headers, rows), 'clients-' + dateSlice + '.csv');
}

function exportFacilitiesCSV() {
  var items = Object.values(S.facilities).filter(function(f) { return !f.archived; });
  items.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var headers = ['Name', 'City', 'State', 'Warden', 'Field Office', 'Field Office Director'];
  var rows = items.map(function(f) {
    return [f.name || '', f.city || '', f.state || '', f.warden || '', f.fieldOfficeName || '', f.fieldOfficeDirector || ''];
  });
  downloadCSV(buildCSV(headers, rows), 'facilities-' + new Date().toISOString().slice(0, 10) + '.csv');
}

function exportCourtsCSV() {
  var items = Object.values(S.courts).filter(function(c) { return !c.archived; });
  items.sort(function(a, b) { return (a.district || '').localeCompare(b.district || ''); });
  var headers = ['District', 'Division', 'Circuit', 'CM/ECF Portal', 'PACER Page'];
  var rows = items.map(function(c) {
    return [c.district || '', c.division || '', c.circuit || '', c.ecfUrl || c.website || '', c.pacerUrl || ''];
  });
  downloadCSV(buildCSV(headers, rows), 'courts-' + new Date().toISOString().slice(0, 10) + '.csv');
}

function exportAttorneyProfilesCSV() {
  var items = Object.values(S.attProfiles).filter(function(a) { return !a.archived; });
  items.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var headers = ['Name', 'Bar No', 'Firm', 'Address', 'City/State/Zip', 'Phone', 'Fax', 'Email', 'Pro Hac Vice'];
  var rows = items.map(function(a) {
    return [a.name || '', a.barNo || '', a.firm || '', a.address || '', a.cityStateZip || '', a.phone || '', a.fax || '', a.email || '', a.proHacVice || ''];
  });
  downloadCSV(buildCSV(headers, rows), 'attorney-profiles-' + new Date().toISOString().slice(0, 10) + '.csv');
}

// ── Template-based export (uses template.html) ─────────────────
function buildExportFromTemplate(vars, forWord, pageSettings) {
  var ps = pageSettings || DEFAULT_PAGE_SETTINGS;
  var caseNo = (vars.CASE_NUMBER && vars.CASE_NUMBER.trim()) ? 'C/A No. ' + vars.CASE_NUMBER : '';
  function resolveExpVar(text, pgNum, pgTotal) {
    if (!text) return '';
    return text
      .replace(/\{\{PAGE\}\}/g, 'Page ' + pgNum + ' of ' + pgTotal)
      .replace(/\{\{PAGE_NUM\}\}/g, String(pgNum))
      .replace(/\{\{TOTAL_PAGES\}\}/g, String(pgTotal))
      .replace(/\{\{CASE_NUMBER\}\}/g, caseNo);
  }
  return fetch('template.html')
    .then(function(r) {
      if (!r.ok) throw new Error('Template fetch failed: ' + r.status);
      return r.text();
    })
    .then(function(html) {
      // Replace <span class="ph">{{VAR}}</span> with value or [VAR]
      html = html.replace(/<span class="ph">\{\{(\w+)\}\}<\/span>/g, function(_, k) {
        return (vars[k] && vars[k].trim()) ? esc(vars[k]) : '[' + k + ']';
      });
      // Replace bare {{VAR}} (e.g. inside <h2> headings)
      html = html.replace(/\{\{(\w+)\}\}/g, function(_, k) {
        return (vars[k] && vars[k].trim()) ? vars[k] : '[' + k + ']';
      });
      // Override .ph styling for export (no red color)
      html = html.replace('.ph {', '.ph-disabled {');

      // Inject header/footer into template pages
      var hasHeader = ps.headerLeft || ps.headerCenter || ps.headerRight;
      var hasFooter = ps.footerLeft || ps.footerCenter || ps.footerRight;
      var hfCss = '.page-hf{display:flex;justify-content:space-between;font-size:9pt;color:#666;font-family:"Times New Roman",serif}.page-hf span{flex:1}.page-hf span:nth-child(2){text-align:center}.page-hf span:last-child{text-align:right}.page-hdr{margin-bottom:12pt}.page-ftr{margin-top:auto;padding-top:12pt}';

      if (forWord) {
        // Word path: inject headers/footers at section boundaries (existing behavior)
        if (hasHeader || hasFooter) {
          html = html.replace('</style>', hfCss + '\n</style>');
          var pageMatches = html.match(/<section class="page">/g) || [];
          var totalPages = pageMatches.length;

          var pgIdx = 0;
          html = html.replace(/<section class="page">/g, function() {
            pgIdx++;
            var isFirst = pgIdx === 1;
            var hdrHtml = '';
            if (hasHeader && (!isFirst || ps.showHeaderOnFirstPage)) {
              hdrHtml = '<div class="page-hf page-hdr"><span>' + resolveExpVar(ps.headerLeft, pgIdx, totalPages) + '</span><span>' + resolveExpVar(ps.headerCenter, pgIdx, totalPages) + '</span><span>' + resolveExpVar(ps.headerRight, pgIdx, totalPages) + '</span></div>';
            }
            return '<section class="page">' + hdrHtml;
          });

          pgIdx = 0;
          html = html.replace(/<\/section>/g, function() {
            pgIdx++;
            var isFirst = pgIdx === 1;
            var ftrHtml = '';
            if (hasFooter && (!isFirst || ps.showFooterOnFirstPage)) {
              ftrHtml = '<div class="page-hf page-ftr"><span>' + resolveExpVar(ps.footerLeft, pgIdx, totalPages) + '</span><span>' + resolveExpVar(ps.footerCenter, pgIdx, totalPages) + '</span><span>' + resolveExpVar(ps.footerRight, pgIdx, totalPages) + '</span></div>';
            }
            return ftrHtml + '</section>';
          });
        }
      } else {
        // PDF path: embed raw page settings for DOM-based pagination in the print window
        var printCss = hfCss + '\n@media print{.page{display:flex;flex-direction:column;min-height:9in}}';
        html = html.replace('</style>', printCss + '\n</style>');
        var psData = JSON.stringify({
          headerLeft: ps.headerLeft || '',
          headerCenter: ps.headerCenter || '',
          headerRight: ps.headerRight || '',
          footerLeft: ps.footerLeft || '',
          footerCenter: ps.footerCenter || '',
          footerRight: ps.footerRight || '',
          showHeaderOnFirstPage: !!ps.showHeaderOnFirstPage,
          showFooterOnFirstPage: !!ps.showFooterOnFirstPage,
          caseNo: caseNo
        });
        html = html.replace('<body>', '<body data-page-settings="' + psData.replace(/"/g, '&quot;') + '">');
      }

      if (forWord) {
        // Add Word XML namespaces for .doc compatibility
        html = html.replace('<!doctype html>', '');
        html = html.replace('<html lang="en">', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
        // Replace HTML5 meta charset with http-equiv form Word understands
        html = html.replace('<meta charset="utf-8" />', '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">');
        // Remove viewport meta tag which Word doesn't understand
        html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1" />', '');
        // Inject Word XML document settings after <head>
        var wordXml = '<!--[if gte mso 9]><xml>' +
          '<o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>' +
          '</xml><xml>' +
          '<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>' +
          '</xml><![endif]-->';
        html = html.replace('<head>', '<head>\n' + wordXml);
        // Add Word-specific page setup CSS
        var msoCss = '\n  @page WordSection1 { size: 8.5in 11in; margin: 1in; mso-header-margin: 0.5in; mso-footer-margin: 0.5in; mso-paper-source: 0; }' +
          '\n  div.WordSection1 { page: WordSection1; }';
        html = html.replace('</style>', msoCss + '\n</style>');
        // Wrap body content in a WordSection1 div
        html = html.replace('<body>', '<body><div class="WordSection1">');
        html = html.replace('</body>', '</div></body>');
      }
      return html;
    });
}

// ── PDF print-window pagination ─────────────────────────────────
function paginatePrintWindow(w) {
  var doc = w.document;
  var sections = doc.querySelectorAll('section.page');
  if (sections.length < 1) return;

  // Parse page settings embedded by buildExportFromTemplate
  var psRaw = doc.body.getAttribute('data-page-settings');
  var ps;
  try { ps = JSON.parse(psRaw || '{}'); } catch(e) { ps = {}; }

  var hasHeader = ps.headerLeft || ps.headerCenter || ps.headerRight;
  var hasFooter = ps.footerLeft || ps.footerCenter || ps.footerRight;

  var captionSection = sections[0];
  var bodySection = sections.length > 1 ? sections[sections.length - 1] : null;
  if (!bodySection) return;

  // Measure each direct child element of the body section
  var children = Array.from(bodySection.children);
  var measurements = [];
  children.forEach(function(el) {
    var rect = el.getBoundingClientRect();
    var cs = w.getComputedStyle(el);
    var mt = parseFloat(cs.marginTop) || 0;
    var mb = parseFloat(cs.marginBottom) || 0;
    measurements.push({
      el: el,
      h: rect.height + mt + mb,
      isHeading: el.tagName === 'H2' || (el.className && el.className.indexOf('section') >= 0)
    });
  });

  // Usable height per page: 11in - 2*1in @page margin = 9in = 864px at 96 DPI
  // Reserve space for footer (~28px)
  var USABLE_H = 9 * 96 - 28;

  // Split into page-sized groups
  var pageGroups = [];
  var current = [];
  var remaining = USABLE_H;

  for (var i = 0; i < measurements.length; i++) {
    var m = measurements[i];
    if (m.h > remaining && current.length > 0) {
      pageGroups.push(current);
      current = [];
      remaining = USABLE_H;
    }
    // Heading orphan prevention: if heading fits alone but heading + next block doesn't,
    // push heading to next page so it stays with its content
    if (m.isHeading && current.length > 0 && i + 1 < measurements.length) {
      var nextH = measurements[i + 1].h;
      if (m.h <= remaining && m.h + nextH > remaining) {
        pageGroups.push(current);
        current = [];
        remaining = USABLE_H;
      }
    }
    current.push(m);
    remaining -= m.h;
  }
  if (current.length > 0) pageGroups.push(current);

  var totalPages = pageGroups.length + 1; // +1 for caption page

  function resolvePageVar(text, pageNum) {
    if (!text) return '';
    return text
      .replace(/\{\{PAGE\}\}/g, 'Page ' + pageNum + ' of ' + totalPages)
      .replace(/\{\{PAGE_NUM\}\}/g, String(pageNum))
      .replace(/\{\{TOTAL_PAGES\}\}/g, String(totalPages))
      .replace(/\{\{CASE_NUMBER\}\}/g, ps.caseNo || '');
  }

  function makeFooter(pageNum) {
    var div = doc.createElement('div');
    div.className = 'page-hf page-ftr';
    div.innerHTML = '<span>' + resolvePageVar(ps.footerLeft, pageNum) +
      '</span><span>' + resolvePageVar(ps.footerCenter, pageNum) +
      '</span><span>' + resolvePageVar(ps.footerRight, pageNum) + '</span>';
    return div;
  }

  function makeHeader(pageNum) {
    var div = doc.createElement('div');
    div.className = 'page-hf page-hdr';
    div.innerHTML = '<span>' + resolvePageVar(ps.headerLeft, pageNum) +
      '</span><span>' + resolvePageVar(ps.headerCenter, pageNum) +
      '</span><span>' + resolvePageVar(ps.headerRight, pageNum) + '</span>';
    return div;
  }

  var parent = bodySection.parentNode;

  // Build new sections for each page group
  pageGroups.forEach(function(group, idx) {
    var pageNum = idx + 2; // caption is page 1
    var isFirst = false; // body pages are never the "first" page
    var section = doc.createElement('section');
    section.className = 'page';

    if (hasHeader && (!isFirst || ps.showHeaderOnFirstPage)) {
      section.appendChild(makeHeader(pageNum));
    }

    group.forEach(function(item) {
      section.appendChild(item.el);
    });

    if (hasFooter) {
      section.appendChild(makeFooter(pageNum));
    }

    parent.insertBefore(section, bodySection);
  });

  parent.removeChild(bodySection);

  // Handle caption page (page 1) header and footer
  if (hasFooter && ps.showFooterOnFirstPage) {
    captionSection.appendChild(makeFooter(1));
  }
  if (hasHeader && ps.showHeaderOnFirstPage) {
    captionSection.insertBefore(makeHeader(1), captionSection.firstChild);
  }
}

// ── Matrix sync helpers ─────────────────────────────────────────
var _syncTimers = {};
function debouncedSync(key, fn) {
  if (_syncTimers[key]) clearTimeout(_syncTimers[key].timer);
  _syncTimers[key] = {
    timer: setTimeout(function() { delete _syncTimers[key]; fn(); }, 1000),
    fn: fn
  };
}

// Actions that should only save on blur (field exit), not every keystroke
var BLUR_SAVE_ACTIONS = { 'national-field': 1, 'client-field': 1, 'editor-client-field': 1, 'editor-pet-field': 1, 'filing-case-number': 1 };

// Update only the in-memory state for a field (no log entry, no Matrix sync).
// Called on every keystroke to keep the UI responsive; the actual save
// (log + sync) happens via dispatchFieldChange on the 'change' event (blur).
function updateFieldLocally(action, key, val) {
  if (action === 'national-field') {
    if (S.role !== 'admin') return;
    S.national[key] = val;
    S.national.updatedBy = S.currentUser;
    S.national.updatedAt = now();
    refreshVariableSpans();
    return;
  }
  if (action === 'client-field') {
    var client = S.selectedClientId ? S.clients[S.selectedClientId] : null;
    if (!client) return;
    if (S.role !== 'admin') {
      var hasOwnership = Object.values(S.petitions).some(function(p) {
        return p.clientId === client.id && p.createdBy === S.currentUser;
      });
      if (!hasOwnership) return;
    }
    client[key] = val;
    refreshVariableSpans();
    return;
  }
  if (action === 'editor-client-field') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;
    var client = S.clients[pet.clientId];
    if (!client) return;
    client[key] = val;
    refreshVariableSpans();
    return;
  }
  if (action === 'editor-pet-field') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;
    pet[key] = val;
    refreshVariableSpans();
    return;
  }
  if (action === 'filing-case-number') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    pet.caseNumber = val;
    refreshVariableSpans();
    return;
  }
}

function syncClientToMatrix(client, label) {
  if (!matrix.isReady() || !client.roomId) return Promise.resolve();
  return matrix.sendStateEvent(client.roomId, EVT_CLIENT, {
    id: client.id, name: client.name, country: client.country,
    yearsInUS: client.yearsInUS, entryDate: client.entryDate,
    entryMethod: client.entryMethod,
    apprehensionLocation: client.apprehensionLocation,
    apprehensionDate: client.apprehensionDate,
    criminalHistory: client.criminalHistory,
    communityTies: client.communityTies,
  }, '').then(function(data) {
    if (label) toast('CON \u22C8 ' + label, 'success');
    return data;
  }).catch(function(e) { console.error('Client sync failed:', e); toast('ALT \u21CC client sync failed', 'error'); });
}

// Create a Matrix room for a client and sync initial data
var _pendingRoomCreations = {};
function createClientRoom(clientId) {
  if (!matrix.isReady()) return Promise.resolve();
  var client = S.clients[clientId];
  if (!client) return Promise.resolve();
  // Already has a room
  if (client.roomId) return Promise.resolve(client.roomId);
  // Room creation already in flight for this client
  if (_pendingRoomCreations[clientId]) return _pendingRoomCreations[clientId];
  var roomName = 'client:' + (client.name || client.id);
  _pendingRoomCreations[clientId] = matrix.createRoom({
    name: roomName,
    visibility: 'private',
    preset: 'private_chat',
    initial_state: [
      {
        type: EVT_CLIENT,
        state_key: '',
        content: {
          id: client.id, name: client.name, country: client.country,
          yearsInUS: client.yearsInUS, entryDate: client.entryDate,
          entryMethod: client.entryMethod,
          apprehensionLocation: client.apprehensionLocation,
          apprehensionDate: client.apprehensionDate,
          criminalHistory: client.criminalHistory,
          communityTies: client.communityTies,
        },
      },
    ],
  }).then(function(data) {
    var roomId = data.room_id;
    // Update local cache
    if (!matrix.rooms[roomId]) matrix.rooms[roomId] = { stateEvents: {} };
    if (!matrix.rooms[roomId].stateEvents[EVT_CLIENT]) matrix.rooms[roomId].stateEvents[EVT_CLIENT] = {};
    matrix.rooms[roomId].stateEvents[EVT_CLIENT][''] = {
      content: {
        id: client.id, name: client.name, country: client.country,
        yearsInUS: client.yearsInUS, entryDate: client.entryDate,
        entryMethod: client.entryMethod,
        apprehensionLocation: client.apprehensionLocation,
        apprehensionDate: client.apprehensionDate,
        criminalHistory: client.criminalHistory,
        communityTies: client.communityTies,
      },
      sender: matrix.userId,
      origin_server_ts: Date.now(),
    };
    // Update client's roomId in state
    client.roomId = roomId;
    S.clients[clientId] = client;
    // Also update roomId on any petitions for this client
    Object.values(S.petitions).forEach(function(p) {
      if (p.clientId === clientId && !p.roomId) {
        p.roomId = roomId;
        // Sync any pending petitions now that we have a roomId
        syncPetitionToMatrix(p, 'petition');
        if (p.blocks && p.blocks.length > 0) {
          matrix.sendStateEvent(roomId, EVT_PETITION_BLOCKS, { blocks: p.blocks }, p.id)
            .catch(function(e) { console.error('Block sync failed:', e); toast('ALT \u21CC block sync failed', 'error'); });
        }
      }
    });
    console.log('Created Matrix room for client', clientId, '→', roomId);
    if (matrix.isReady()) {
      inviteAdminsToRoom(roomId);
    }
    delete _pendingRoomCreations[clientId];
    return roomId;
  }).catch(function(e) {
    console.error('Failed to create client room:', e);
    delete _pendingRoomCreations[clientId];
    toast('INS \u2295 client room failed', 'error');
    return null;
  });
  return _pendingRoomCreations[clientId];
}

function syncPetitionToMatrix(pet, label) {
  if (!matrix.isReady() || !pet.roomId) return Promise.resolve();
  var content = {
    clientId: pet.clientId, createdBy: pet.createdBy, stage: pet.stage, stageHistory: pet.stageHistory,
    district: pet.district, division: pet.division, courtWebsite: pet.courtWebsite || '', caseNumber: pet.caseNumber,
    facilityName: pet.facilityName, facilityCity: pet.facilityCity,
    facilityState: pet.facilityState, warden: pet.warden,
    fieldOfficeDirector: pet.fieldOfficeDirector, fieldOfficeName: pet.fieldOfficeName,
    filingDate: pet.filingDate, filingDay: pet.filingDay,
    filingMonthYear: pet.filingMonthYear,
    _facilityId: pet._facilityId, _courtId: pet._courtId,
    _att1Id: pet._att1Id, _att2Id: pet._att2Id,
    templateId: pet.templateId,
    pageSettings: pet.pageSettings,
    natIceDirector: pet.natIceDirector, natIceDirectorTitle: pet.natIceDirectorTitle,
    natDhsSecretary: pet.natDhsSecretary, natAttorneyGeneral: pet.natAttorneyGeneral,
    _bodyEdited: !!pet._bodyEdited, _exported: !!pet._exported,
  };
  if (pet.archived) content.archived = true;
  return matrix.sendStateEvent(pet.roomId, EVT_PETITION, content, pet.id).then(function(data) {
    if (label) toast('CON \u22C8 ' + label, 'success');
    return data;
  }).catch(function(e) {
    console.error('Petition sync failed:', e);
    toast(label ? 'CON \u22C8 ' + label + ' failed' : 'ALT \u21CC petition sync failed', 'error');
  });
}

// ── Block / Variable HTML helpers ────────────────────────────────
var CLS_MAP = {
  title: 'blk-title', heading: 'blk-heading', para: 'blk-para',
  'cap-name': 'blk-cap-name', 'cap-center': 'blk-cap-center',
  'cap-resp': 'blk-cap-resp', 'cap-case': 'blk-cap-case',
  'cap-doctitle': 'blk-cap-doctitle', sig: 'blk-sig', 'sig-label': 'blk-sig-label',
};

function blockToHtml(content, vars) {
  var h = content.replace(/\n/g, '<br/>');
  return h.replace(/\{\{(\w+)\}\}/g, function(_, k) {
    var v = vars[k] ? vars[k].trim() : '';
    return v
      ? '<span data-var="' + k + '" contenteditable="false" class="vf">' + esc(v) + '</span>'
      : '<span data-var="' + k + '" contenteditable="false" class="ve">\u27E8' + k + '\u27E9</span>';
  });
}

function extractBlockContent(el) {
  var c = el.cloneNode(true);
  c.querySelectorAll('br').forEach(function(b) {
    b.replaceWith('\n');
  });
  c.querySelectorAll('[data-var]').forEach(function(s) {
    s.replaceWith('{{' + s.dataset.var + '}}');
  });
  return c.textContent || '';
}

// Update all variable spans in the document in-place (no full re-render).
// Called on every keystroke while editing sidebar fields so the document
// preview instantly reflects the new values.
function refreshVariableSpans() {
  if (S.currentView !== 'editor') return;
  var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
  if (!pet) return;
  var client = S.clients[pet.clientId] || {};
  var att1 = pet._att1Id ? S.attProfiles[pet._att1Id] : {};
  var att2 = pet._att2Id ? S.attProfiles[pet._att2Id] : {};
  var vars = buildVarMap(client, pet, att1, att2, S.national);
  var spans = document.querySelectorAll('[data-var]');
  for (var i = 0; i < spans.length; i++) {
    var span = spans[i];
    var k = span.dataset.var;
    var v = vars[k] ? vars[k].trim() : '';
    if (v) {
      span.textContent = v;
      span.className = 'vf';
    } else {
      span.textContent = '\u27E8' + k + '\u27E9';
      span.className = 've';
    }
  }
}

// ── Component Renderers ──────────────────────────────────────────
function htmlFieldGroup(title, fields, data, onChangePrefix) {
  var h = '<div class="fg">';
  if (title) h += '<div class="fg-title">' + esc(title) + '</div>';
  fields.forEach(function(f) {
    if (f.type === 'date-group' && f.key === 'filingDate') {
      h += htmlDateGroupField(fields, data, onChangePrefix);
      return;
    }
    if (f.key === 'filingDay' || f.key === 'filingMonthYear') return; // rendered by date-group
    var val = (data && data[f.key]) || '';
    var chk = val && val.trim() ? '<span class="fchk">&#10003;</span>' : '';
    var vErr = '';
    if (f.validate && val && val.trim()) {
      var err = f.validate(val);
      if (err) {
        vErr = '<span class="fval-err">' + esc(err) + '</span>';
        chk = '<span class="fval-warn">&#9888;</span>';
      }
    }
    h += '<div class="frow"><label class="flbl">' + esc(f.label) + chk + '</label>';
    h += htmlFieldInput(f, val, onChangePrefix);
    h += vErr + '</div>';
  });
  h += '</div>';
  return h;
}

function htmlFieldInput(f, val, onChangePrefix) {
  if (f.type === 'enum') return htmlEnumSelect(f, val, onChangePrefix);
  if (f.type === 'enum-or-custom') return htmlEnumOrCustom(f, val, onChangePrefix);
  if (f.type === 'date') return htmlDateField(f, val, onChangePrefix);
  return '<input type="text" class="finp" value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '" data-field-key="' + f.key + '" data-change="' + onChangePrefix + '">';
}

function htmlEnumSelect(f, val, onChangePrefix) {
  var h = '<select class="finp" data-field-key="' + f.key + '" data-change="' + onChangePrefix + '">';
  h += '<option value="">\u2014 Select \u2014</option>';
  var foundVal = false;
  for (var i = 0; i < f.options.length; i++) {
    var opt = f.options[i];
    if (opt === '---') {
      h += '<option disabled>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</option>';
      continue;
    }
    var sel = (opt === val) ? ' selected' : '';
    if (opt === val) foundVal = true;
    h += '<option value="' + esc(opt) + '"' + sel + '>' + esc(opt) + '</option>';
  }
  if (val && val.trim() && !foundVal) {
    h += '<option value="' + esc(val) + '" selected>' + esc(val) + ' (custom)</option>';
  }
  h += '</select>';
  return h;
}

function htmlEnumOrCustom(f, val, onChangePrefix) {
  var isPreset = false;
  for (var i = 0; i < f.options.length; i++) {
    if (f.options[i] === val) { isPreset = true; break; }
  }
  var isEmpty = !val || !val.trim();
  var isCustom = !isEmpty && !isPreset;

  var h = '<select class="finp enum-custom-sel" data-field-key="' + f.key + '" data-change="' + onChangePrefix + '-enum">';
  for (var i = 0; i < f.options.length; i++) {
    var opt = f.options[i];
    var sel = (opt === val) ? ' selected' : '';
    h += '<option value="' + esc(opt) + '"' + sel + '>' + esc(opt) + '</option>';
  }
  h += '<option value="__custom__"' + (isCustom ? ' selected' : '') + '>Other (custom)</option>';
  h += '</select>';
  var display = isCustom ? '' : ' style="display:none"';
  h += '<input type="text" class="finp enum-custom-inp" value="' + (isCustom ? esc(val) : '') + '"' +
       ' placeholder="Enter custom value..." data-field-key="' + f.key + '" data-change="' + onChangePrefix + '-custom"' + display + '>';
  return h;
}

function htmlDateField(f, val, onChangePrefix) {
  return '<input type="text" class="finp date-pick" value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '" data-field-key="' + f.key + '" data-change="' + onChangePrefix + '" data-flatpickr="1">';
}

function htmlDateGroupField(fields, data, onChangePrefix) {
  var filingDate = (data && data.filingDate) || '';
  var filingDay = (data && data.filingDay) || '';
  var filingMonthYear = (data && data.filingMonthYear) || '';
  var chk = filingDate && filingDate.trim() ? '<span class="fchk">&#10003;</span>' : '';
  var h = '<div class="frow"><label class="flbl">Filing Date' + chk + '</label>';
  h += '<input type="text" class="finp date-pick" value="' + esc(filingDate) + '" placeholder="February 19, 2026" data-field-key="filingDate" data-change="' + onChangePrefix + '" data-flatpickr="filing-group">';
  if (filingDate && filingDate.trim()) {
    h += '<div class="date-group-preview">';
    h += 'Day: <strong>' + esc(filingDay) + '</strong> &nbsp; Month/Year: <strong>' + esc(filingMonthYear) + '</strong>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function htmlFacilityAutocomplete() {
  return '<div class="fac-ac-wrap"><label class="flbl">Search ICE Facilities</label>' +
    '<input type="text" class="finp" id="fac-ac-input" placeholder="Type facility name or city..." data-change="fac-ac">' +
    '<div class="fac-ac-list" id="fac-ac-list" style="display:none"></div></div>';
}

function htmlPicker(label, items, displayFn, value, onChangeAction, onNewAction) {
  var h = '<div class="picker"><label class="flbl">' + esc(label) + '</label><div class="picker-row">';
  h += '<select class="finp picker-sel" data-change="' + onChangeAction + '">';
  h += '<option value="">\u2014 Select \u2014</option>';
  items.forEach(function(it) {
    var sel = it.id === value ? ' selected' : '';
    h += '<option value="' + esc(it.id) + '"' + sel + '>' + esc(displayFn(it)) + '</option>';
  });
  h += '</select>';
  if (onNewAction) {
    h += '<button class="hbtn sm" data-action="' + onNewAction + '">+</button>';
  }
  h += '</div></div>';
  return h;
}

function cleanupInlineAdd() {
  if (!S.inlineAdd) return;
  var ia = S.inlineAdd;
  if (ia.type === 'court') {
    var c = S.courts[ia.id];
    if (c && !c.district && !c.division) delete S.courts[ia.id];
  } else if (ia.type === 'facility') {
    var f = S.facilities[ia.id];
    if (f && !f.name) delete S.facilities[ia.id];
  } else {
    var a = S.attProfiles[ia.id];
    if (a && !a.name) delete S.attProfiles[ia.id];
  }
}

function htmlInlineAddForm(type) {
  var fields, saveAction, title;
  if (type === 'court') {
    fields = COURT_FIELDS;
    saveAction = 'inline-save-court';
    title = 'New Court';
  } else if (type === 'facility') {
    fields = FACILITY_FIELDS;
    saveAction = 'inline-save-facility';
    title = 'New Facility';
  } else if (type === 'att1') {
    fields = ATT_PROFILE_FIELDS;
    saveAction = 'inline-save-att1';
    title = 'New Attorney Profile';
  } else if (type === 'att2') {
    fields = ATT_PROFILE_FIELDS;
    saveAction = 'inline-save-att2';
    title = 'New Attorney Profile';
  } else {
    return '';
  }
  var h = '<div class="inline-add-form">';
  h += '<div class="inline-add-head"><span class="inline-add-title">' + esc(title) + '</span></div>';
  if (type === 'facility') {
    h += htmlFacilityAutocomplete();
  }
  fields.forEach(function(ff) {
    var val = (S.draft[ff.key]) || '';
    var chk = val && val.trim() ? '<span class="fchk">&#10003;</span>' : '';
    var vErr = '';
    if (ff.validate && val && val.trim()) { var err = ff.validate(val); if (err) { vErr = '<span class="fval-err">' + esc(err) + '</span>'; chk = '<span class="fval-warn">&#9888;</span>'; } }
    h += '<div class="frow"><label class="flbl">' + esc(ff.label) + chk + '</label>';
    h += htmlFieldInput(ff, val, 'draft-field');
    h += vErr + '</div>';
  });
  h += '<div class="inline-add-actions">';
  h += '<button class="hbtn accent" data-action="' + saveAction + '">Save &amp; Apply</button>';
  h += '<button class="hbtn" data-action="inline-cancel">Cancel</button>';
  h += '</div></div>';
  return h;
}

function petAttorneyNames(p) {
  var names = [];
  if (p._att1Id && S.attProfiles[p._att1Id]) names.push(S.attProfiles[p._att1Id].name);
  if (p._att2Id && S.attProfiles[p._att2Id]) names.push(S.attProfiles[p._att2Id].name);
  return names.length > 0 ? names.join(', ') : '';
}

function htmlProvenanceBadge(record) {
  if (!record || !record.createdBy) return '';
  var h = '<div class="prov"><span class="prov-item">Created by <strong>' + esc(record.createdBy) + '</strong> ';
  if (record.createdAt) h += ts(record.createdAt);
  h += '</span>';
  if (record.updatedAt && record.updatedAt !== record.createdAt) {
    h += '<span class="prov-item">Updated by <strong>' + esc(record.updatedBy || '') + '</strong> ' + ts(record.updatedAt) + '</span>';
  }
  h += '</div>';
  return h;
}

// ── View Renderers ───────────────────────────────────────────────
function renderLogin() {
  if (S._showRegister) {
    var domainsStr = CONFIG.ALLOWED_REGISTRATION_DOMAINS.join(', ');
    return '<div class="login-wrap"><form class="login-box" id="register-form">' +
      '<div class="login-brand">Habeas</div>' +
      '<div class="login-sub">Amino Immigration</div>' +
      '<div class="login-sub" style="margin:-12px 0 16px;font-size:11px;color:var(--accent)">Create Account</div>' +
      '<div id="register-error" class="login-error" style="display:none"></div>' +
      '<div class="frow"><label class="flbl">Email</label>' +
      '<input class="finp" type="email" id="register-email" placeholder="you@' + esc(CONFIG.ALLOWED_REGISTRATION_DOMAINS[0]) + '" autofocus></div>' +
      '<div class="frow"><label class="flbl">Username</label>' +
      '<input class="finp" type="text" id="register-user" placeholder="jsmith"></div>' +
      '<div class="frow"><label class="flbl">Display Name</label>' +
      '<input class="finp" type="text" id="register-display" placeholder="Jane Smith"></div>' +
      '<div class="frow"><label class="flbl">Password</label>' +
      '<input class="finp" type="password" id="register-pass" placeholder="Choose a strong password"></div>' +
      '<div class="frow"><label class="flbl">Confirm Password</label>' +
      '<input class="finp" type="password" id="register-pass2" placeholder="Confirm password"></div>' +
      '<button type="submit" class="hbtn accent login-btn" id="register-btn">Create Account</button>' +
      '<div class="login-toggle">Already have an account? <a href="#" data-action="show-login">Sign In</a></div>' +
      '<div class="login-server">Allowed domains: ' + esc(domainsStr) + '</div>' +
      '</form></div>';
  }
  return '<div class="login-wrap"><form class="login-box" id="login-form">' +
    '<div class="login-brand">Habeas</div>' +
    '<div class="login-sub">Amino Immigration</div>' +
    '<div id="login-error" class="login-error" style="display:none"></div>' +
    '<div class="frow"><label class="flbl">Username</label>' +
    '<input class="finp" type="text" id="login-user" placeholder="attorney" autofocus></div>' +
    '<div class="frow"><label class="flbl">Password</label>' +
    '<input class="finp" type="password" id="login-pass" placeholder="password"></div>' +
    '<button type="submit" class="hbtn accent login-btn" id="login-btn">Sign In</button>' +
    '<div class="login-toggle">Need an account? <a href="#" data-action="show-register">Register</a></div>' +
    '<div class="login-server">Server: ' + CONFIG.MATRIX_SERVER_URL.replace('https://', '') + '</div>' +
    '</form></div>';
}

function renderHeader() {
  var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
  var petClient = pet ? S.clients[pet.clientId] : null;
  var h = '<header class="hdr"><div class="hdr-left">';
  h += '<span class="hdr-brand">Habeas</span><nav class="hdr-nav">';
  var tabs = [['board','Board'],['clients','Clients'],['directory','Directory']];
  if (S.role === 'admin') tabs.push(['admin','Admin']);
  if (pet) tabs.push(['editor','Editor']);
  tabs.forEach(function(t) {
    h += '<button class="nav-btn' + (S.currentView === t[0] ? ' on' : '') + '" data-action="nav" data-view="' + t[0] + '">' + t[1] + '</button>';
  });
  h += '</nav></div><div class="hdr-right">';
  h += '<span class="role-badge" style="color:' + (S.role === 'admin' ? '#a08540' : '#8a8a9a') + '">' + (S.isSynapseAdmin ? 'Super Admin' : S.role === 'admin' ? 'Admin' : 'Attorney') + '</span>';
  if (pet) {
    var sm = SM[pet.stage] || SM.intake;
    h += '<span class="stage-badge" style="background:' + sm.color + '">' + pet.stage + '</span>';
    h += '<button class="hbtn export" data-action="export-word">DOCX</button>';
    h += '<button class="hbtn export" data-action="export-pdf">PDF</button>';
  }
  // Environment indicator — visible to all users so everyone knows DEV vs PROD
  if (S.deployInfo && S.deployInfo.env === 'production' && S.deployInfo.sha !== 'local') {
    h += '<span class="deploy-version-pill deploy-env-production" title="' + esc(S.deployInfo.message) + '">';
    h += 'PROD';
    if (S.role === 'admin') h += ' <code>' + esc(S.deployInfo.shortSha) + '</code>';
    h += '</span>';
  } else {
    h += '<span class="deploy-version-pill deploy-env-development" title="Development mode — not the live production version">DEV</span>';
  }
  h += '<button class="hbtn" data-action="show-password-change" title="Change Password" style="font-size:12px">Password</button>';
  h += '<button class="hbtn" data-action="logout">Sign Out</button>';
  h += '</div></header>';
  return h;
}

function renderBoard() {
  var all = Object.values(S.petitions);
  var vis = S.role === 'admin' ? all : all.filter(function(p) { return p.createdBy === S.currentUser; });
  // Filter archived petitions unless toggle is active
  vis = vis.filter(function(p) { return S.boardShowArchived || !p.archived; });

  var h = '<div class="board-view">';

  // Toggle bar
  h += '<div class="board-toggle-bar">';
  h += '<div class="board-toggle">';
  h += '<button class="board-toggle-btn' + (S.boardMode === 'kanban' ? ' on' : '') + '" data-action="board-mode" data-mode="kanban">Kanban</button>';
  h += '<button class="board-toggle-btn' + (S.boardMode === 'table' ? ' on' : '') + '" data-action="board-mode" data-mode="table">Table</button>';
  h += '</div>';

  if (S.boardMode === 'table') {
    h += '<div class="board-group-sel">';
    h += '<label class="board-group-label">Group by</label>';
    h += '<select class="finp board-group-input" data-change="board-table-group">';
    ['stage', 'attorney', 'facility', 'court', 'readiness'].forEach(function(g) {
      h += '<option value="' + g + '"' + (S.boardTableGroup === g ? ' selected' : '') + '>' + g.charAt(0).toUpperCase() + g.slice(1) + '</option>';
    });
    h += '</select>';
    h += '</div>';
  }

  h += '<div class="board-export-btns">';
  h += '<button class="hbtn sm" data-action="export-petitions-csv">&#8681; Petitions CSV</button>';
  h += '<button class="hbtn sm" data-action="export-clients-csv">&#8681; Clients CSV</button>';
  h += '<label class="archive-toggle"><input type="checkbox" data-action="toggle-board-archived"' + (S.boardShowArchived ? ' checked' : '') + '> Archived</label>';
  h += '</div>';

  // Add Matter button / inline client picker
  var clientList = Object.values(S.clients).filter(function(c) { return !c.archived; });
  if (S.role !== 'admin') {
    var myBoardClientIds = {};
    Object.values(S.petitions).forEach(function(p) {
      if (p.createdBy === S.currentUser) myBoardClientIds[p.clientId] = true;
    });
    clientList = clientList.filter(function(c) { return myBoardClientIds[c.id]; });
  }
  if (S.boardAddingMatter && clientList.length > 0) {
    h += '<div class="board-add-matter">';
    h += '<select class="finp board-add-matter-sel" data-change="board-create-matter">';
    h += '<option value="">Select client\u2026</option>';
    clientList.forEach(function(c) {
      h += '<option value="' + c.id + '">' + esc(c.name || 'Unnamed') + '</option>';
    });
    h += '</select>';
    h += '<button class="hbtn" data-action="board-cancel-add-matter">Cancel</button>';
    h += '</div>';
  } else {
    h += '<button class="hbtn accent" data-action="board-add-matter">+ Add Matter</button>';
  }

  h += '</div>';

  if (S.boardMode === 'table') {
    h += renderBoardTable(vis);
  } else {
    h += renderBoardKanban(vis);
  }

  if (vis.length === 0) {
    h += '<div class="board-empty"><p>No matters yet. Click <strong>+ Add Matter</strong> above, or go to <strong>Clients</strong> to get started.</p></div>';
  }

  h += '</div>';
  return h;
}

function renderBoardKanban(vis) {
  var h = '<div class="kanban">';
  var NOW = Date.now();
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  STAGES.forEach(function(stage) {
    var items = vis.filter(function(p) { return p.stage === stage; })
      .sort(function(a, b) {
        // For filed: sort by time entered filed (newest first)
        if (stage === 'filed') {
          var aTime = filedAt(a);
          var bTime = filedAt(b);
          return bTime - aTime;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    var m = SM[stage];

    // For filed column, compute hidden count
    var hiddenCount = 0;
    if (stage === 'filed' && !S.boardShowAllFiled) {
      hiddenCount = items.filter(function(p) {
        var age = NOW - filedAt(p);
        return age >= WEEK_MS;
      }).length;
    }

    h += '<div class="kb-col" data-stage="' + stage + '"><div class="kb-col-head" style="border-bottom-color:' + m.color + '">';
    h += '<span class="kb-col-title">' + m.label + '</span>';
    h += '<span class="kb-col-count" style="background:' + m.color + '">' + items.length + '</span>';
    h += '</div><div class="kb-col-body" data-drop-stage="' + stage + '">';
    if (items.length === 0) {
      h += '<div class="kb-empty">None</div>';
    }
    items.forEach(function(p) {
      // For filed cards: compute opacity based on age
      var fadeStyle = '';
      var isHidden = false;
      if (stage === 'filed') {
        var age = NOW - filedAt(p);
        if (age >= WEEK_MS && !S.boardShowAllFiled) {
          isHidden = true;
          return; // skip rendering
        }
        // Fade from 1.0 (just filed) to 0.25 (approaching 1 week)
        var ratio = Math.min(age / WEEK_MS, 1);
        var opacity = 1 - (ratio * 0.75); // 1.0 → 0.25
        if (opacity < 1) {
          fadeStyle = ' opacity:' + opacity.toFixed(2) + ';';
        }
      }

      var cl = S.clients[p.clientId];
      var si = STAGES.indexOf(p.stage);
      var attNames = petAttorneyNames(p);
      var canArchivePet = S.role === 'admin' || p.createdBy === S.currentUser;
      var rdns = computeReadiness(p, cl || {});
      var pctW = Math.round(rdns.score * 100);
      h += '<div class="kb-card' + (p.archived ? ' archived' : '') + '" draggable="true" data-drag-id="' + p.id + '" style="border-left-color:' + m.color + ';' + fadeStyle + '" data-action="open-petition" data-id="' + p.id + '">';
      h += '<div class="kb-card-name">' + esc(cl ? cl.name || 'Unnamed' : 'Unnamed') + '</div>';
      h += '<div class="kb-card-meta">' + esc(p.caseNumber || 'No case no.') + (p.district ? ' \u00b7 ' + esc(p.district) : '') + '</div>';
      h += '<div class="kb-card-meta">' + esc(p.facilityName || '') + '</div>';
      if (attNames) {
        h += '<div class="kb-card-meta kb-card-att">' + esc(attNames) + '</div>';
      }
      if (p.archived) h += '<span class="archived-badge">Archived</span>';
      h += '<div class="kb-card-date">' + new Date(p.createdAt).toLocaleDateString() + ' <span class="kb-card-ago">(' + timeAgo(p.createdAt) + ')</span></div>';
      // Progress bar
      h += '<div class="kb-progress" title="' + pctW + '% complete (' + rdns.done + '/' + rdns.total + ')"><div class="kb-progress-bar" style="width:' + pctW + '%"></div></div>';
      if (p.stageHistory && p.stageHistory.length > 1) {
        h += '<div class="kb-dots">';
        p.stageHistory.forEach(function(sh) {
          var sc = SM[sh.stage] ? SM[sh.stage].color : '#ccc';
          h += '<span class="kb-dot" style="background:' + sc + '" title="' + (SM[sh.stage] ? SM[sh.stage].label : sh.stage) + ' ' + ts(sh.at) + '"></span>';
        });
        h += '</div>';
      }
      h += '<div class="kb-card-actions">';
      if (p.archived) {
        if (canArchivePet) h += '<button class="kb-btn accent" data-action="recover-petition" data-id="' + p.id + '">Recover</button>';
      } else {
        if (si > 0) h += '<button class="kb-btn" data-action="stage-change" data-id="' + p.id + '" data-dir="revert">&larr; ' + SM[STAGES[si - 1]].label + '</button>';
        if (p.stage === 'filing') h += '<button class="kb-btn accent" data-action="open-filing" data-id="' + p.id + '">File Now</button>';
        else if (si < STAGES.length - 1) h += '<button class="kb-btn accent" data-action="stage-change" data-id="' + p.id + '" data-dir="advance">' + SM[STAGES[si + 1]].label + ' &rarr;</button>';
        if (canArchivePet) h += '<button class="kb-btn" data-action="archive-petition" data-id="' + p.id + '">Archive</button>';
      }
      h += '</div></div>';
    });

    // Show all toggle for filed column
    if (stage === 'filed' && hiddenCount > 0) {
      h += '<button class="kb-show-all-btn" data-action="toggle-show-all-filed">Show ' + hiddenCount + ' older</button>';
    }
    if (stage === 'filed' && S.boardShowAllFiled) {
      h += '<button class="kb-show-all-btn" data-action="toggle-show-all-filed">Hide older</button>';
    }

    h += '</div></div>';
  });
  h += '</div>';
  return h;
}

// Helper: get the timestamp when a petition entered the filed stage
function filedAt(p) {
  if (p.stageHistory && p.stageHistory.length > 0) {
    for (var i = p.stageHistory.length - 1; i >= 0; i--) {
      if (p.stageHistory[i].stage === 'filed' || p.stageHistory[i].stage === 'submitted') {
        return new Date(p.stageHistory[i].at).getTime();
      }
    }
  }
  return new Date(p.createdAt).getTime();
}

// ── Completeness / Readiness Checklist ───────────────────────────
function computeReadiness(pet, client) {
  client = client || {};
  pet = pet || {};
  var items = [
    { key: 'client_name', label: 'Client name', ok: !!(client.name && client.name.trim()) },
    { key: 'client_country', label: 'Country of origin', ok: !!(client.country && client.country.trim()) },
    { key: 'entry_date', label: 'Entry date', ok: !!(client.entryDate && client.entryDate.trim()) },
    { key: 'entry_method', label: 'Entry method', ok: !!(client.entryMethod && client.entryMethod.trim()) },
    { key: 'apprehension_loc', label: 'Apprehension location', ok: !!(client.apprehensionLocation && client.apprehensionLocation.trim()) },
    { key: 'apprehension_date', label: 'Apprehension date', ok: !!(client.apprehensionDate && client.apprehensionDate.trim()) },
    { key: 'court', label: 'Court assigned', ok: !!pet._courtId },
    { key: 'facility', label: 'Facility assigned', ok: !!pet._facilityId },
    { key: 'attorney1', label: 'Lead attorney', ok: !!pet._att1Id },
    { key: 'filing_date', label: 'Filing date', ok: !!(pet.filingDate && pet.filingDate.trim()) },
    { key: 'warden', label: 'Warden name', ok: !!(pet.warden && pet.warden.trim()) },
    { key: 'body_edited', label: 'Document body edited', ok: !!pet._bodyEdited },
    { key: 'case_number', label: 'Case number', ok: !!(pet.caseNumber && pet.caseNumber.trim()) },
    { key: 'exported', label: 'Document exported', ok: !!pet._exported },
  ];
  var done = items.filter(function(it) { return it.ok; }).length;
  var missing = items.filter(function(it) { return !it.ok; }).map(function(it) { return it.label; });
  return {
    score: items.length > 0 ? done / items.length : 0,
    total: items.length,
    done: done,
    items: items,
    missingLabels: missing,
    ready: done === items.length,
  };
}

// Stage gate: check if transition from current stage to next is allowed
var STAGE_GATES = {
  // intake → drafting: need client name + country
  'intake>drafting': ['client_name', 'client_country'],
  // drafting → review: need court, facility, attorney
  'drafting>review': ['court', 'facility', 'attorney1'],
  // review → filing: need filing date, warden, document edited
  'review>filing': ['filing_date', 'warden', 'body_edited'],
  // filing → filed: need case number, document exported
  'filing>filed': ['case_number', 'exported'],
};

function checkStageGate(pet, client, fromStage, toStage) {
  var gateKey = fromStage + '>' + toStage;
  var required = STAGE_GATES[gateKey];
  if (!required) return { allowed: true, missing: [] }; // no gate (revert or skip)
  var readiness = computeReadiness(pet, client);
  var missing = [];
  required.forEach(function(key) {
    var item = readiness.items.filter(function(it) { return it.key === key; })[0];
    if (item && !item.ok) missing.push(item.label);
  });
  return { allowed: missing.length === 0, missing: missing };
}

// Helper: render mini timeline dots for a petition
function renderTimelineDots(p) {
  var h = '';
  var reached = {};
  if (p.stageHistory) {
    p.stageHistory.forEach(function(sh) {
      var s = migrateStage(sh.stage);
      if (!reached[s]) reached[s] = sh.at;
    });
  }
  STAGES.forEach(function(s, i) {
    if (i > 0) h += '<span class="tl-seg"></span>';
    var isReached = !!reached[s];
    var isCurrent = p.stage === s;
    var sm = SM[s];
    var title = sm.label;
    if (isReached) title += ': ' + new Date(reached[s]).toLocaleDateString();
    if (isCurrent) title += ' (current)';
    h += '<span class="tl-dot' + (isReached ? '' : ' empty') + (isCurrent ? ' active' : '') + '" style="' + (isReached ? 'background:' + sm.color : '') + '" title="' + esc(title) + '"></span>';
  });
  return h;
}

// Helper: time in current stage
function timeInStage(p) {
  if (!p.stageHistory || p.stageHistory.length === 0) return timeAgo(p.createdAt);
  var last = p.stageHistory[p.stageHistory.length - 1];
  return timeAgo(last.at);
}

function renderBoardTable(vis) {
  var groupKey = S.boardTableGroup;
  var groups = {};

  vis.forEach(function(p) {
    var key;
    if (groupKey === 'stage') {
      key = p.stage || 'intake';
    } else if (groupKey === 'attorney') {
      key = petAttorneyNames(p) || 'Unassigned';
    } else if (groupKey === 'facility') {
      key = p.facilityName || 'No Facility';
    } else if (groupKey === 'court') {
      key = p.district || 'No Court';
    } else if (groupKey === 'readiness') {
      var cl = S.clients[p.clientId] || {};
      var rdns = computeReadiness(p, cl);
      if (rdns.score >= 1) key = 'Ready';
      else if (rdns.score >= 0.5) key = 'In Progress';
      else key = 'Needs Attention';
    } else {
      key = 'All';
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  var groupKeys;
  if (groupKey === 'stage') {
    groupKeys = STAGES.filter(function(s) { return groups[s]; });
  } else if (groupKey === 'readiness') {
    groupKeys = ['Ready', 'In Progress', 'Needs Attention'].filter(function(k) { return groups[k]; });
  } else {
    groupKeys = Object.keys(groups).sort();
  }

  var colSpan = 10;
  var h = '<div class="board-table-wrap"><table class="board-table">';
  h += '<thead><tr>';
  h += '<th>Client</th><th>Case No.</th><th>Stage</th><th>Readiness</th><th>District</th>';
  h += '<th>Facility</th><th>Attorney(s)</th><th>Timeline</th><th>Created</th><th>In Stage</th>';
  h += '</tr></thead>';
  h += '<tbody>';

  groupKeys.forEach(function(gk) {
    var items = groups[gk];
    items.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var collapsed = _collapsedGroups[groupKey + ':' + gk];
    var sm = (groupKey === 'stage' && SM[gk]) ? SM[gk] : null;
    var colorDot = sm ? '<span class="kb-dot" style="background:' + sm.color + ';display:inline-block;vertical-align:middle;margin-right:6px"></span>' : '';

    h += '<tr class="board-table-group-hdr" data-action="toggle-group" data-group="' + esc(groupKey + ':' + gk) + '">';
    h += '<td colspan="' + colSpan + '">';
    h += '<span class="group-arrow">' + (collapsed ? '&#9654;' : '&#9660;') + '</span> ';
    h += colorDot + '<strong>' + esc(gk) + '</strong> <span class="group-count">(' + items.length + ')</span>';
    h += '</td></tr>';

    if (!collapsed) {
      items.forEach(function(p) {
        var cl = S.clients[p.clientId];
        var attNames = petAttorneyNames(p);
        var stm = SM[p.stage] || SM.intake;
        var rdns = computeReadiness(p, cl || {});
        var pctW = Math.round(rdns.score * 100);
        var missTip = rdns.missingLabels.length > 0 ? rdns.missingLabels.join(', ') : 'Complete';
        h += '<tr class="board-table-row' + (p.archived ? ' archived' : '') + '" data-action="open-petition" data-id="' + p.id + '">';
        h += '<td class="bt-client">' + esc(cl ? cl.name || 'Unnamed' : 'Unnamed') + '</td>';
        h += '<td>' + esc(p.caseNumber || '\u2014') + '</td>';
        h += '<td><span class="stage-badge sm" style="background:' + stm.color + '">' + esc(stm.label) + '</span>' + (p.archived ? ' <span class="archived-badge">Archived</span>' : '') + '</td>';
        // Readiness column
        h += '<td class="bt-readiness" title="' + esc(missTip) + '">';
        if (pctW >= 100) {
          h += '<span class="filing-check-ok">\u2713</span>';
        } else {
          h += '<span class="readiness-bar"><span class="readiness-fill" style="width:' + pctW + '%"></span></span>';
          h += '<span class="readiness-pct">' + pctW + '%</span>';
        }
        h += '</td>';
        h += '<td>' + esc(p.district || '\u2014') + '</td>';
        h += '<td>' + esc(p.facilityName || '\u2014') + '</td>';
        h += '<td>' + esc(attNames || '\u2014') + '</td>';
        // Timeline column
        h += '<td class="bt-timeline">' + renderTimelineDots(p) + '</td>';
        h += '<td class="bt-date">' + new Date(p.createdAt).toLocaleDateString() + '</td>';
        // In Stage column
        h += '<td class="bt-age">' + timeInStage(p) + '</td>';
        h += '</tr>';
      });
    }
  });

  h += '</tbody></table></div>';
  return h;
}

function renderClients() {
  var allClients = Object.values(S.clients);
  var clientList;
  if (S.role === 'admin') {
    clientList = allClients;
  } else {
    var myClientIds = {};
    Object.values(S.petitions).forEach(function(p) {
      if (p.createdBy === S.currentUser) myClientIds[p.clientId] = true;
    });
    clientList = allClients.filter(function(c) { return myClientIds[c.id]; });
  }
  // Filter archived clients unless toggle is active
  clientList = clientList.filter(function(c) { return S.clientsShowArchived || !c.archived; });
  var client = S.selectedClientId ? S.clients[S.selectedClientId] : null;
  var clientPets = client ? Object.values(S.petitions).filter(function(p) { return p.clientId === client.id; }) : [];
  var h = '<div class="clients-view"><div class="cv-sidebar"><div class="cv-head">';
  h += '<span class="cv-title">Clients</span>';
  h += '<button class="hbtn accent" data-action="create-client">+ New</button>';
  h += '<label class="archive-toggle"><input type="checkbox" data-action="toggle-clients-archived"' + (S.clientsShowArchived ? ' checked' : '') + '> Archived</label>';
  h += '</div>';
  h += '<div class="cv-list">';
  if (clientList.length === 0) {
    h += '<div class="cv-empty">No clients yet.</div>';
  }
  clientList.forEach(function(c) {
    var pets = Object.values(S.petitions).filter(function(p) { return p.clientId === c.id && !p.archived; });
    h += '<div class="cv-item' + (S.selectedClientId === c.id ? ' on' : '') + (c.archived ? ' archived' : '') + '" data-action="select-client" data-id="' + c.id + '">';
    h += '<div class="cv-item-name">' + esc(c.name || 'Unnamed') + '</div>';
    if (c.archived) {
      h += '<span class="archived-badge">Archived</span>';
    } else {
      h += '<div class="cv-item-meta">' + esc(c.country || '') + (pets.length > 0 ? ' \u00b7 ' + pets.length + ' matter' + (pets.length !== 1 ? 's' : '') : '') + '</div>';
      pets.forEach(function(p) {
        var sc = SM[p.stage] ? SM[p.stage].color : '#ccc';
        h += '<span class="stage-badge sm" style="background:' + sc + '">' + p.stage + '</span>';
      });
    }
    h += '</div>';
  });
  h += '</div></div>';
  h += '<div class="cv-detail">';
  if (client) {
    var canArchiveClient = S.role === 'admin' || clientPets.some(function(p) { return p.createdBy === S.currentUser; });
    h += '<div class="cv-detail-head"><h2>' + esc(client.name || 'New Client') + '</h2>';
    if (client.archived) {
      h += '<span class="archived-badge">Archived</span>';
      if (canArchiveClient) h += '<button class="hbtn accent sm" data-action="recover-client" data-id="' + client.id + '">Recover</button>';
    } else {
      h += '<button class="hbtn accent" data-action="create-petition" data-client-id="' + client.id + '">+ New Matter</button>';
      if (canArchiveClient) h += '<button class="hbtn danger sm" data-action="archive-client" data-id="' + client.id + '">Archive</button>';
    }
    h += '</div>';
    h += htmlFieldGroup('Client Information', CLIENT_FIELDS, client, 'client-field');
    if (clientPets.length > 0) {
      h += '<div class="fg"><div class="fg-title">Matters</div>';
      clientPets.forEach(function(p) {
        var sc = SM[p.stage] ? SM[p.stage].color : '#ccc';
        h += '<div class="pet-row" data-action="open-petition" data-id="' + p.id + '">';
        h += '<span class="stage-badge" style="background:' + sc + '">' + p.stage + '</span>';
        h += '<span style="flex:1;font-size:12px">' + esc(p.caseNumber || 'No case no.') + '</span>';
        if (p.archived) h += '<span class="archived-badge">Archived</span>';
        h += '<span style="font-size:11px;color:#aaa">' + new Date(p.createdAt).toLocaleDateString() + '</span>';
        h += '</div>';
      });
      h += '</div>';
    }
  } else {
    h += '<div class="cv-empty-detail"><div style="font-size:48px;opacity:.3;margin-bottom:16px">&#9878;</div><p>Select or create a client.</p></div>';
  }
  h += '</div></div>';
  return h;
}

function renderDirectory() {
  var tab = S.dirTab;
  var isAdmin = S.role === 'admin';
  var h = '<div class="dir-view"><div class="dir-tabs">';
  [['facilities', 'Facilities (' + Object.values(S.facilities).filter(function(f) { return !f.archived; }).length + ')'],
   ['courts', 'Courts (' + Object.values(S.courts).filter(function(c) { return !c.archived; }).length + ')'],
   ['attorneys', 'Attorney Profiles (' + Object.values(S.attProfiles).filter(function(a) { return !a.archived; }).length + ')'],
   ['national', 'National Defaults']].forEach(function(t) {
    h += '<button class="dir-tab' + (tab === t[0] ? ' on' : '') + '" data-action="dir-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
  });
  h += '</div><div class="dir-body">';

  if (tab === 'facilities') {
    h += '<div class="dir-section"><div class="dir-head"><h3>Detention Facilities</h3>';
    if (isAdmin) h += '<button class="hbtn accent" data-action="add-facility">+ Add Facility</button>';
    if (isAdmin) h += '<button class="hbtn sm" data-action="export-facilities-csv">&#8681; CSV</button>';
    if (isAdmin) h += '<label class="archive-toggle"><input type="checkbox" data-action="toggle-dir-archived"' + (S.dirShowArchived ? ' checked' : '') + '> Show archived</label>';
    h += '</div>';
    h += '<p class="dir-desc">Each facility bundles its warden, location, and linked field office. Selecting a facility on a matter auto-fills all six fields.</p>';
    h += '<div class="dir-list">';
    var facList = Object.values(S.facilities).filter(function(f) { return S.dirShowArchived || !f.archived; });
    facList.forEach(function(f) {
      if (f.archived) {
        h += '<div class="dir-card archived">';
        h += '<div class="dir-card-head" style="cursor:default"><strong>' + esc(f.name || 'Unnamed Facility') + '</strong>';
        h += '<span class="dir-card-sub">' + esc(f.city || '') + ', ' + esc(f.state || '') + '</span></div>';
        h += '<div class="dir-card-detail">Warden: ' + esc(f.warden || '\u2014') + ' \u00b7 FO: ' + esc(f.fieldOfficeName || '\u2014') + ' \u00b7 FOD: ' + esc(f.fieldOfficeDirector || '\u2014') + '</div>';
        h += '<div class="dir-card-actions"><span class="archived-badge">Archived</span>';
        if (isAdmin) h += '<button class="hbtn accent sm" data-action="recover-facility" data-id="' + f.id + '">Recover</button>';
        h += '</div>';
      } else if (isAdmin && S.editId !== f.id) {
        h += '<div class="dir-card" data-action="edit-record" data-id="' + f.id + '" data-type="facility">';
      } else {
        h += '<div class="dir-card' + (S.editId === f.id ? ' editing' : '') + '">';
      }
      if (!f.archived && S.editId === f.id && isAdmin) {
        h += htmlFacilityAutocomplete();
        FACILITY_FIELDS.forEach(function(ff) {
          var val = (S.draft[ff.key]) || '';
          var chk = val && val.trim() ? '<span class="fchk">&#10003;</span>' : '';
          var vErr = '';
          if (ff.validate && val && val.trim()) { var err = ff.validate(val); if (err) { vErr = '<span class="fval-err">' + esc(err) + '</span>'; chk = '<span class="fval-warn">&#9888;</span>'; } }
          h += '<div class="frow"><label class="flbl">' + esc(ff.label) + chk + '</label>';
          h += htmlFieldInput(ff, val, 'draft-field');
          h += vErr + '</div>';
        });
        h += '<div class="dir-card-actions"><button class="hbtn accent" data-action="save-facility">Save</button>';
        h += '<button class="hbtn" data-action="cancel-edit">Cancel</button>';
        h += '<button class="hbtn danger" data-action="archive-facility" data-id="' + f.id + '">Archive</button></div>';
      } else if (!f.archived) {
        h += '<div class="dir-card-head">';
        h += '<strong>' + esc(f.name || 'Unnamed Facility') + '</strong>';
        h += '<span class="dir-card-sub">' + esc(f.city || '') + ', ' + esc(f.state || '') + '</span></div>';
        if (isAdmin) {
          h += '<div class="dir-card-detail">Warden: ' + esc(f.warden || '\u2014') + ' \u00b7 FO: ' + esc(f.fieldOfficeName || '\u2014') + ' \u00b7 FOD: ' + esc(f.fieldOfficeDirector || '\u2014') + '</div>';
        } else {
          h += '<div class="frow" style="margin:8px 0"><label class="flbl">Warden</label>';
          h += '<div style="display:flex;gap:6px;flex:1"><input class="finp" value="' + esc(f.warden || '') + '" data-warden-input="' + f.id + '" placeholder="Enter warden name">';
          h += '<button class="hbtn accent" data-action="update-warden" data-id="' + f.id + '" style="white-space:nowrap">Update</button></div></div>';
          h += '<div class="dir-card-detail">FO: ' + esc(f.fieldOfficeName || '\u2014') + ' \u00b7 FOD: ' + esc(f.fieldOfficeDirector || '\u2014') + '</div>';
        }
        if (f.wardenUpdatedBy) {
          h += '<div class="prov"><span class="prov-item">Warden updated by <strong>' + esc(f.wardenUpdatedBy) + '</strong> ' + ts(f.wardenUpdatedAt) + '</span></div>';
        }
        h += htmlProvenanceBadge(f);
      }
      h += '</div>';
    });
    if (facList.length === 0) h += '<div class="dir-empty">No facilities yet.' + (isAdmin ? ' Add one to get started.' : '') + '</div>';
    h += '</div></div>';
  }

  if (tab === 'courts') {
    h += '<div class="dir-section"><div class="dir-head"><h3>Courts</h3>';
    if (isAdmin) h += '<button class="hbtn accent" data-action="add-court">+ Add Court</button>';
    if (isAdmin) h += '<button class="hbtn sm" data-action="export-courts-csv">&#8681; CSV</button>';
    if (isAdmin) h += '<label class="archive-toggle"><input type="checkbox" data-action="toggle-dir-archived"' + (S.dirShowArchived ? ' checked' : '') + '> Show archived</label>';
    h += '</div>';
    h += '<p class="dir-desc">Federal district courts with CM/ECF and PACER portal links. Selecting a court on a matter fills district + division.</p>';
    h += '<div class="dir-list">';
    var crtList = Object.values(S.courts).filter(function(c) { return S.dirShowArchived || !c.archived; });
    crtList.forEach(function(c) {
      if (c.archived) {
        h += '<div class="dir-card archived">';
        h += '<div class="dir-card-head" style="cursor:default"><strong>' + esc(c.district || 'Unnamed') + '</strong>';
        h += '<span class="dir-card-sub">' + esc(c.division || '') + '</span></div>';
        h += '<div class="dir-card-actions"><span class="archived-badge">Archived</span>';
        if (isAdmin) h += '<button class="hbtn accent sm" data-action="recover-court" data-id="' + c.id + '">Recover</button>';
        h += '</div>';
      } else if (isAdmin && S.editId !== c.id) {
        h += '<div class="dir-card" data-action="edit-record" data-id="' + c.id + '" data-type="court">';
      } else {
        h += '<div class="dir-card' + (S.editId === c.id ? ' editing' : '') + '">';
      }
      if (!c.archived && S.editId === c.id && isAdmin) {
        COURT_FIELDS.forEach(function(ff) {
          var val = (S.draft[ff.key]) || '';
          var chk = val && val.trim() ? '<span class="fchk">&#10003;</span>' : '';
          h += '<div class="frow"><label class="flbl">' + esc(ff.label) + chk + '</label>';
          h += htmlFieldInput(ff, val, 'draft-field');
          h += '</div>';
        });
        h += '<div class="dir-card-actions"><button class="hbtn accent" data-action="save-court">Save</button>';
        h += '<button class="hbtn" data-action="cancel-edit">Cancel</button>';
        h += '<button class="hbtn danger" data-action="archive-court" data-id="' + c.id + '">Archive</button></div>';
      } else if (!c.archived) {
        h += '<div class="dir-card-head">';
        h += '<strong>' + esc(c.district || 'Unnamed') + '</strong>';
        if (c.circuit) h += '<span class="dir-card-badge">Cir. ' + esc(c.circuit) + '</span>';
        h += '<span class="dir-card-sub">' + esc(c.division || '') + '</span></div>';
        if (c.ecfUrl || c.website || c.pacerUrl) {
          h += '<div class="dir-card-links">';
          if (c.ecfUrl || c.website) h += '<a href="' + esc(c.ecfUrl || c.website) + '" target="_blank" rel="noopener" class="dir-link">CM/ECF Portal &#8599;</a>';
          if (c.pacerUrl) h += '<a href="' + esc(c.pacerUrl) + '" target="_blank" rel="noopener" class="dir-link">PACER &#8599;</a>';
          h += '</div>';
        }
        h += htmlProvenanceBadge(c);
      }
      h += '</div>';
    });
    if (crtList.length === 0) h += '<div class="dir-empty">No courts yet.</div>';
    h += '</div></div>';
  }

  if (tab === 'attorneys') {
    h += '<div class="dir-section"><div class="dir-head"><h3>Attorney Profiles</h3>';
    if (isAdmin) h += '<button class="hbtn accent" data-action="add-attorney">+ Add Attorney</button>';
    if (isAdmin) h += '<button class="hbtn sm" data-action="export-attorneys-csv">&#8681; CSV</button>';
    if (isAdmin) h += '<label class="archive-toggle"><input type="checkbox" data-action="toggle-dir-archived"' + (S.dirShowArchived ? ' checked' : '') + '> Show archived</label>';
    h += '</div>';
    h += '<p class="dir-desc">Reusable attorney profiles. Select as Attorney 1 or 2 on any matter.</p>';
    h += '<div class="dir-list">';
    var attList = Object.values(S.attProfiles).filter(function(a) { return S.dirShowArchived || !a.archived; });
    attList.forEach(function(a) {
      if (a.archived) {
        h += '<div class="dir-card archived">';
        h += '<div class="dir-card-head" style="cursor:default"><strong>' + esc(a.name || 'Unnamed') + '</strong>';
        h += '<span class="dir-card-sub">' + esc(a.firm || '') + ' \u00b7 ' + esc(a.barNo || '') + '</span></div>';
        h += '<div class="dir-card-detail">' + esc(a.email || '') + ' \u00b7 ' + esc(a.phone || '') + '</div>';
        h += '<div class="dir-card-actions"><span class="archived-badge">Archived</span>';
        if (isAdmin) h += '<button class="hbtn accent sm" data-action="recover-attorney" data-id="' + a.id + '">Recover</button>';
        h += '</div>';
      } else if (isAdmin && S.editId !== a.id) {
        h += '<div class="dir-card" data-action="edit-record" data-id="' + a.id + '" data-type="attorney">';
      } else {
        h += '<div class="dir-card' + (S.editId === a.id ? ' editing' : '') + '">';
      }
      if (!a.archived && S.editId === a.id && isAdmin) {
        ATT_PROFILE_FIELDS.forEach(function(ff) {
          var val = (S.draft[ff.key]) || '';
          var chk = val && val.trim() ? '<span class="fchk">&#10003;</span>' : '';
          var vErr = '';
          if (ff.validate && val && val.trim()) { var err = ff.validate(val); if (err) { vErr = '<span class="fval-err">' + esc(err) + '</span>'; chk = '<span class="fval-warn">&#9888;</span>'; } }
          h += '<div class="frow"><label class="flbl">' + esc(ff.label) + chk + '</label>';
          h += htmlFieldInput(ff, val, 'draft-field');
          h += vErr + '</div>';
        });
        h += '<div class="dir-card-actions"><button class="hbtn accent" data-action="save-attorney">Save</button>';
        h += '<button class="hbtn" data-action="cancel-edit">Cancel</button>';
        h += '<button class="hbtn danger" data-action="archive-attorney" data-id="' + a.id + '">Archive</button></div>';
      } else if (!a.archived) {
        h += '<div class="dir-card-head">';
        h += '<strong>' + esc(a.name || 'Unnamed') + '</strong>';
        h += '<span class="dir-card-sub">' + esc(a.firm || '') + ' \u00b7 ' + esc(a.barNo || '') + '</span></div>';
        h += '<div class="dir-card-detail">' + esc(a.email || '') + ' \u00b7 ' + esc(a.phone || '') + '</div>';
        h += htmlProvenanceBadge(a);
      }
      h += '</div>';
    });
    if (attList.length === 0) h += '<div class="dir-empty">No attorney profiles yet.</div>';
    h += '</div></div>';
  }

  if (tab === 'national') {
    h += '<div class="dir-section"><div class="dir-head"><h3>National Defaults</h3></div>';
    h += '<p class="dir-desc">These auto-fill on every matter.' + (isAdmin ? ' Update when officials change.' : '') + '</p>';
    h += '<div class="dir-card editing">';
    NATIONAL_FIELDS.forEach(function(f) {
      var val = (S.national[f.key]) || '';
      var chk = val && val.trim() ? '<span class="fchk">&#10003;</span>' : '';
      h += '<div class="frow"><label class="flbl">' + esc(f.label) + chk + '</label>';
      if (isAdmin) {
        h += htmlFieldInput(f, val, 'national-field');
      } else {
        h += '<input class="finp" value="' + esc(val) + '" disabled style="background:#f5f2ec;color:var(--muted)">';
      }
      h += '</div>';
    });
    h += htmlProvenanceBadge(S.national);
    h += '</div></div>';
  }

  h += '</div></div>';
  return h;
}

// ── GitHub Deployment API ────────────────────────────────────────
function ghApiFetch(path, options) {
  var token = S.deployGithubToken;
  if (!token) return Promise.reject({ error: 'No GitHub token configured' });
  var repo = (S.deployInfo && S.deployInfo.repo) || 'clovenbradshaw-ctrl/habeas_app';
  var url = 'https://api.github.com/repos/' + repo + path;
  var opts = Object.assign({
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
    }
  }, options || {});
  return fetch(url, opts).then(function(r) {
    if (!r.ok) return r.json().then(function(d) { throw d; });
    return r.json();
  });
}

function loadDeployHistory() {
  setState({ deployHistoryLoaded: false, deployHistoryError: '' });
  // Fetch merged PRs and recent commits on default branch
  return ghApiFetch('/commits?sha=main&per_page=30')
    .then(function(commits) {
      var history = commits.map(function(c) {
        var msg = c.commit.message || '';
        var prMatch = msg.match(/#(\d+)/);
        return {
          sha: c.sha,
          shortSha: c.sha.substring(0, 7),
          message: msg.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date,
          prNumber: prMatch ? prMatch[1] : '',
          isCurrent: S.deployInfo && c.sha === S.deployInfo.sha,
        };
      });
      setState({ deployHistory: history, deployHistoryLoaded: true });
    })
    .catch(function(e) {
      setState({
        deployHistoryError: e.message || e.error || 'Failed to load history',
        deployHistoryLoaded: true,
      });
    });
}

function triggerRollback(sha, reason) {
  setState({ deployRollbackBusy: true });
  var repo = (S.deployInfo && S.deployInfo.repo) || 'clovenbradshaw-ctrl/habeas_app';
  return fetch('https://api.github.com/repos/' + repo + '/actions/workflows/rollback.yml/dispatches', {
    method: 'POST',
    headers: {
      'Authorization': 'token ' + S.deployGithubToken,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        target_sha: sha,
        reason: reason || 'Admin rollback from deployment panel',
      }
    })
  }).then(function(r) {
    setState({ deployRollbackBusy: false });
    if (r.status === 204 || r.ok) {
      toast('Rollback triggered. Deploying ' + sha.substring(0, 7) + '...', 'success');
    } else {
      return r.json().then(function(d) {
        toast('Rollback failed: ' + (d.message || r.status), 'error');
      });
    }
  }).catch(function(e) {
    setState({ deployRollbackBusy: false });
    toast('Rollback failed: ' + (e.message || 'Network error'), 'error');
  });
}

function triggerProductionDeploy(sha) {
  setState({ deployDeployBusy: true });
  var repo = (S.deployInfo && S.deployInfo.repo) || 'clovenbradshaw-ctrl/habeas_app';
  return fetch('https://api.github.com/repos/' + repo + '/actions/workflows/deploy.yml/dispatches', {
    method: 'POST',
    headers: {
      'Authorization': 'token ' + S.deployGithubToken,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        target_sha: sha || '',
      }
    })
  }).then(function(r) {
    setState({ deployDeployBusy: false });
    if (r.status === 204 || r.ok) {
      toast('Production deploy triggered' + (sha ? ' for ' + sha.substring(0, 7) : '') + '. Users will see the update shortly.', 'success');
    } else {
      return r.json().then(function(d) {
        toast('Deploy failed: ' + (d.message || r.status), 'error');
      });
    }
  }).catch(function(e) {
    setState({ deployDeployBusy: false });
    toast('Deploy failed: ' + (e.message || 'Network error'), 'error');
  });
}

// ── Review gate: load diff between production and main HEAD ─────
function loadDeployDiff() {
  var info = S.deployInfo;
  var baseSha = (info && info.env === 'production' && info.sha !== 'local') ? info.sha : '';
  setState({ deployReviewState: 'loading', deployDiffError: '', deployDiffFiles: [], deployDiffStats: null });

  if (!baseSha) {
    // No production SHA known — fetch latest deploy from GitHub deployments API
    ghApiFetch('/deployments?environment=production&per_page=1')
      .then(function(deps) {
        if (deps && deps.length > 0) {
          baseSha = deps[0].sha;
          return fetchDiffCompare(baseSha);
        }
        // No deployments found — show all commits on main as pending
        setState({
          deployReviewState: 'reviewing',
          deployDiffBaseSha: '',
          deployDiffHeadSha: 'main',
          deployDiffFiles: [],
          deployDiffStats: { total_commits: S.deployHistory.length, files_changed: 0, additions: 0, deletions: 0, noBaseline: true },
        });
      })
      .catch(function(e) {
        // Fallback: show review without diff details
        setState({
          deployReviewState: 'reviewing',
          deployDiffError: 'Could not determine production baseline: ' + (e.message || e.error || 'unknown'),
          deployDiffBaseSha: '',
          deployDiffHeadSha: 'main',
        });
      });
  } else {
    fetchDiffCompare(baseSha);
  }
}

function fetchDiffCompare(baseSha) {
  setState({ deployDiffBaseSha: baseSha });
  return ghApiFetch('/compare/' + baseSha + '...main')
    .then(function(data) {
      var files = (data.files || []).map(function(f) {
        return {
          filename: f.filename,
          status: f.status, // added, removed, modified, renamed
          additions: f.additions || 0,
          deletions: f.deletions || 0,
        };
      });
      setState({
        deployReviewState: 'reviewing',
        deployDiffHeadSha: data.commits && data.commits.length > 0 ? data.commits[data.commits.length - 1].sha : 'main',
        deployDiffFiles: files,
        deployDiffStats: {
          total_commits: data.total_commits || 0,
          files_changed: files.length,
          additions: data.ahead_by || 0,
          deletions: 0,
        },
      });
    })
    .catch(function(e) {
      setState({
        deployReviewState: 'reviewing',
        deployDiffError: 'Failed to load diff: ' + (e.message || e.error || 'unknown'),
      });
    });
}

function approveDeployReview() {
  setState({ deployReviewState: 'approved' });
}

function resetDeployReview() {
  setState({ deployReviewState: 'none', deployDiffFiles: [], deployDiffStats: null, deployDiffError: '', deployDiffBaseSha: '', deployDiffHeadSha: '' });
}

function renderDeployments() {
  var h = '<div class="dir-section">';
  var info = S.deployInfo;
  var isProduction = info && info.env === 'production' && info.sha !== 'local';

  // ── Current Production Version ────────────────────────────────
  h += '<div class="dir-head"><h3>Production (Live)</h3></div>';
  if (isProduction) {
    h += '<div class="deploy-current-card">';
    h += '<div class="deploy-env-badge deploy-env-production">PRODUCTION</div>';
    if (info.rollback) {
      h += '<div class="deploy-rollback-badge">ROLLBACK</div>';
    }
    h += '<div class="deploy-version"><strong>Commit:</strong> <code>' + esc(info.shortSha) + '</code></div>';
    if (info.prNumber) {
      h += '<div class="deploy-version"><strong>PR:</strong> #' + esc(info.prNumber) + '</div>';
    }
    h += '<div class="deploy-version"><strong>Message:</strong> ' + esc(info.message) + '</div>';
    h += '<div class="deploy-version"><strong>Author:</strong> ' + esc(info.author) + '</div>';
    h += '<div class="deploy-version"><strong>Deployed:</strong> ' + ts(info.timestamp) + '</div>';
    h += '</div>';
  } else {
    h += '<div class="deploy-mode-banner deploy-mode-dev">';
    h += '<div class="deploy-mode-icon">&#9888;</div>';
    h += '<div><strong>Development Mode</strong><br><span style="font-size:12px;color:var(--muted)">This instance is not running a production deployment. Changes merged to main will NOT go live until an admin triggers a deploy.</span></div>';
    h += '</div>';
  }

  // ── Pages setup reminder ──────────────────────────────────────
  h += '<div class="deploy-setup-note">';
  h += '<strong>Auto-deploy prevention:</strong> GitHub Pages must be set to Source = <code>GitHub Actions</code> (not "Deploy from a branch"). ';
  h += 'Go to <em>Settings &rarr; Pages &rarr; Source</em> and select <strong>GitHub Actions</strong>. ';
  h += 'This ensures merges to <code>main</code> never auto-deploy &mdash; only the "Deploy to Production" button below triggers a live update.';
  h += '</div>';

  // ── GitHub token configuration ────────────────────────────────
  h += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">';
  h += '<div class="dir-head"><h3>GitHub Access</h3></div>';
  h += '<p class="dir-desc">Enter a GitHub personal access token with <code>repo</code> and <code>workflow</code> scopes to manage deployments. The token is stored in the organization room and shared across sessions.</p>';
  h += '<div style="display:flex;gap:8px;align-items:center;max-width:600px">';
  h += '<input class="finp" type="password" value="' + esc(S.deployGithubToken) + '" placeholder="ghp_xxxxxxxxxxxx" data-change="deploy-gh-token" style="flex:1;font-family:monospace">';
  h += '<button class="hbtn accent" data-action="deploy-save-token">' + (S.deployTokenSet ? 'Update' : 'Save') + '</button>';
  if (S.deployTokenSet) {
    h += '<button class="hbtn" data-action="deploy-clear-token">Clear</button>';
  }
  h += '</div></div>';

  // ── Pending Changes + Deploy to Production ────────────────────
  if (S.deployTokenSet) {
    h += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">';
    h += '<div class="dir-head"><h3>Pending Changes (Dev)</h3><div>';
    h += '<button class="hbtn" data-action="deploy-refresh-history">Refresh</button>';
    h += '</div></div>';
    h += '<p class="dir-desc">Commits merged to <code>main</code> that are <strong>not yet live in production</strong>. Review these changes, then deploy when ready.</p>';

    if (!S.deployHistoryLoaded) {
      h += '<div class="dir-desc" style="color:var(--muted);font-style:italic">Loading commit history...</div>';
    } else if (S.deployHistoryError) {
      h += '<div class="dir-desc" style="color:#b91c1c">' + esc(S.deployHistoryError) + '</div>';
    } else {
      // Split commits into pending (newer than current production) and deployed
      var pendingCommits = [];
      var deployedCommits = [];
      var foundCurrent = false;
      S.deployHistory.forEach(function(entry) {
        if (entry.isCurrent) {
          foundCurrent = true;
          deployedCommits.push(entry);
        } else if (!foundCurrent) {
          pendingCommits.push(entry);
        } else {
          deployedCommits.push(entry);
        }
      });

      // If no current SHA match found (e.g., local dev), all are "pending"
      if (!isProduction) {
        pendingCommits = S.deployHistory.slice();
        deployedCommits = [];
      }

      // ── Pending changes section ──
      if (pendingCommits.length > 0) {
        h += '<div class="deploy-pending-banner">';
        h += '<strong>' + pendingCommits.length + ' pending change' + (pendingCommits.length === 1 ? '' : 's') + '</strong> merged to main but not yet live.';
        h += '</div>';

        h += '<div class="deploy-history-list" style="margin-bottom:12px">';
        pendingCommits.forEach(function(entry) {
          h += '<div class="deploy-history-item deploy-pending-item">';
          h += '<div class="deploy-history-main">';
          h += '<span class="deploy-pending-dot"></span>';
          h += '<code class="deploy-sha">' + esc(entry.shortSha) + '</code>';
          if (entry.prNumber) {
            h += '<span class="deploy-pr-badge">PR #' + esc(entry.prNumber) + '</span>';
          }
          h += '<span class="deploy-msg">' + esc(entry.message) + '</span>';
          h += '</div>';
          h += '<div class="deploy-history-meta">';
          h += '<span>' + esc(entry.author) + '</span>';
          h += '<span>' + timeAgo(entry.date) + '</span>';
          h += '<span class="deploy-pending-badge">PENDING</span>';
          h += '</div>';
          h += '</div>';
        });
        h += '</div>';

        // ── Review Gate: must review before deploying ─────────────
        var reviewState = S.deployReviewState;
        var repo = (S.deployInfo && S.deployInfo.repo) || 'clovenbradshaw-ctrl/habeas_app';

        if (reviewState === 'none') {
          // Step 1: Admin must start a review
          h += '<div class="deploy-review-gate">';
          h += '<div class="deploy-review-gate-icon">&#128270;</div>';
          h += '<div class="deploy-review-gate-text">';
          h += '<strong>Review required before deploying</strong>';
          h += '<span>You must review the changes before they can go live. Click below to see what changed.</span>';
          h += '</div>';
          h += '<button class="hbtn accent" data-action="deploy-start-review">Review Changes</button>';
          h += '</div>';

        } else if (reviewState === 'loading') {
          // Loading diff
          h += '<div class="deploy-review-gate">';
          h += '<div class="deploy-review-loading">Loading change details...</div>';
          h += '</div>';

        } else if (reviewState === 'reviewing') {
          // Step 2: Show diff details for admin to review
          h += '<div class="deploy-review-panel">';
          h += '<div class="deploy-review-header">';
          h += '<h4>Change Review</h4>';
          h += '<button class="hbtn sm" data-action="deploy-cancel-review">Cancel</button>';
          h += '</div>';

          if (S.deployDiffError) {
            h += '<div class="deploy-review-error">' + esc(S.deployDiffError) + '</div>';
          }

          // Summary stats
          if (S.deployDiffStats) {
            var ds = S.deployDiffStats;
            h += '<div class="deploy-review-stats">';
            h += '<span class="deploy-stat">' + pendingCommits.length + ' commit' + (pendingCommits.length !== 1 ? 's' : '') + '</span>';
            if (ds.files_changed > 0) {
              h += '<span class="deploy-stat">' + ds.files_changed + ' file' + (ds.files_changed !== 1 ? 's' : '') + ' changed</span>';
            }
            if (ds.noBaseline) {
              h += '<span class="deploy-stat deploy-stat-warn">No production baseline — showing all pending commits</span>';
            }
            h += '</div>';
          }

          // Changed files list
          if (S.deployDiffFiles.length > 0) {
            h += '<div class="deploy-review-files">';
            h += '<div class="deploy-review-files-header">Changed Files</div>';
            S.deployDiffFiles.forEach(function(f) {
              var statusClass = f.status === 'added' ? 'added' : f.status === 'removed' ? 'removed' : 'modified';
              var statusLabel = f.status === 'added' ? 'A' : f.status === 'removed' ? 'D' : f.status === 'renamed' ? 'R' : 'M';
              h += '<div class="deploy-review-file">';
              h += '<span class="deploy-file-status deploy-file-' + statusClass + '">' + statusLabel + '</span>';
              h += '<a class="deploy-file-name" href="https://github.com/' + esc(repo) + '/blob/main/' + esc(f.filename) + '" target="_blank" rel="noopener">' + esc(f.filename) + '</a>';
              h += '<span class="deploy-file-changes">';
              if (f.additions > 0) h += '<span class="deploy-file-add">+' + f.additions + '</span>';
              if (f.deletions > 0) h += '<span class="deploy-file-del">-' + f.deletions + '</span>';
              h += '</span>';
              h += '</div>';
            });
            h += '</div>';
          }

          // View full diff on GitHub link
          if (S.deployDiffBaseSha) {
            h += '<div style="margin:12px 0">';
            h += '<a class="deploy-github-link" href="https://github.com/' + esc(repo) + '/compare/' + esc(S.deployDiffBaseSha.substring(0, 7)) + '...main" target="_blank" rel="noopener">';
            h += 'View full diff on GitHub &#8599;</a>';
            h += '</div>';
          }

          // Approval checkbox
          h += '<div class="deploy-review-approve">';
          h += '<label class="deploy-approve-label">';
          h += '<input type="checkbox" data-change="deploy-approve-checkbox" class="deploy-approve-check">';
          h += '<span>I have reviewed these changes and approve them for production deployment</span>';
          h += '</label>';
          h += '</div>';

          h += '</div>'; // end review panel

        } else if (reviewState === 'approved') {
          // Step 3: Approved — show deploy button
          h += '<div class="deploy-review-approved">';
          h += '<span class="deploy-approved-badge">&#10003; REVIEWED &amp; APPROVED</span>';
          h += '<button class="hbtn sm" data-action="deploy-cancel-review">Reset</button>';
          h += '</div>';

          h += '<div class="deploy-action-bar">';
          h += '<button class="hbtn accent deploy-production-btn" data-action="deploy-to-production"' + (S.deployDeployBusy ? ' disabled' : '') + '>';
          h += (S.deployDeployBusy ? 'Deploying...' : 'Deploy to Production');
          h += '</button>';
          h += '<span class="deploy-action-desc">This will push the latest <code>main</code> to production. All users will see these changes.</span>';
          h += '</div>';
        }

      } else if (isProduction) {
        h += '<div class="deploy-uptodate-banner">';
        h += '<span class="deploy-uptodate-icon">&#10003;</span> Production is up to date. No pending changes.';
        h += '</div>';
      }

      // ── Previously deployed / version history ──
      h += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">';
      h += '<div class="dir-head"><h3>Version History</h3></div>';
      h += '<p class="dir-desc">All recent commits on <code>main</code>. You can deploy any specific version to production.</p>';

      if (S.deployHistory.length === 0) {
        h += '<div class="dir-empty">No commits found.</div>';
      } else {
        h += '<div class="deploy-history-list">';
        S.deployHistory.forEach(function(entry) {
          var isCurrent = entry.isCurrent;
          h += '<div class="deploy-history-item' + (isCurrent ? ' deploy-current' : '') + '">';
          h += '<div class="deploy-history-main">';
          h += '<code class="deploy-sha">' + esc(entry.shortSha) + '</code>';
          if (entry.prNumber) {
            h += '<span class="deploy-pr-badge">PR #' + esc(entry.prNumber) + '</span>';
          }
          h += '<span class="deploy-msg">' + esc(entry.message) + '</span>';
          h += '</div>';
          h += '<div class="deploy-history-meta">';
          h += '<span>' + esc(entry.author) + '</span>';
          h += '<span>' + timeAgo(entry.date) + '</span>';
          if (isCurrent) {
            h += '<span class="deploy-live-badge">LIVE</span>';
          } else {
            h += '<button class="hbtn sm deploy-btn" data-action="deploy-specific" data-sha="' + esc(entry.sha) + '" data-msg="' + esc(entry.message) + '"' + (S.deployDeployBusy || S.deployRollbackBusy ? ' disabled' : '') + '>Deploy</button>';
          }
          h += '</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function renderAdmin() {
  if (S.role !== 'admin') {
    return '<div class="dir-view"><div class="dir-body" style="text-align:center;padding:60px"><p style="color:var(--muted)">Admin access required.</p></div></div>';
  }

  var h = '<div class="dir-view"><div class="dir-tabs">';
  h += '<button class="dir-tab' + (S.adminTab === 'users' ? ' on' : '') + '" data-action="admin-switch-tab" data-tab="users">User Management</button>';
  h += '<button class="dir-tab' + (S.adminTab === 'deploy' ? ' on' : '') + '" data-action="admin-switch-tab" data-tab="deploy">Deployments</button>';
  h += '</div><div class="dir-body">';

  if (S.adminTab === 'deploy') {
    h += renderDeployments();
    h += '</div></div>';
    return h;
  }

  h += '<div class="dir-section">';

  // Header with create + refresh buttons
  h += '<div class="dir-head"><h3>Users</h3><div>';
  h += '<button class="hbtn accent" data-action="admin-show-create">+ Create User</button>';
  h += '<button class="hbtn" data-action="admin-refresh-users" style="margin-left:8px">Refresh</button>';
  h += '</div></div>';
  h += '<p class="dir-desc">Manage user accounts. Creating a user registers them on the Matrix server, sets their role, and invites them to the required rooms.</p>';

  // Show "Send Credentials" prompt if a user was just created with an email
  if (S._pendingCredentialEmail) {
    var pc = S._pendingCredentialEmail;
    h += '<div class="admin-credential-banner">';
    h += '<span>User <strong>' + esc(pc.displayName) + '</strong> created. Send login credentials to <strong>' + esc(pc.email) + '</strong>?</span>';
    h += '<button class="hbtn accent sm" data-action="admin-send-credentials">Send Credentials</button>';
    h += '<button class="hbtn sm" data-action="admin-dismiss-credential-banner">Dismiss</button>';
    h += '</div>';
  }

  // Server users loading/error status
  if (!S.serverUsersLoaded) {
    h += '<div class="dir-desc" style="color:var(--muted);font-style:italic">Loading server user list...</div>';
  }
  if (S.serverUsersError) {
    h += '<div class="dir-desc" style="color:#b91c1c">' + esc(S.serverUsersError) + '</div>';
  }

  // Inline create form
  if (S.adminEditUserId === 'new') {
    h += '<div class="dir-card editing" style="margin-bottom:16px">';
    h += '<div class="fg-title" style="margin-bottom:12px;font-weight:600">New User</div>';
    h += '<div class="frow"><label class="flbl">Username</label>';
    h += '<input class="finp" value="' + esc(S.adminDraft.username || '') + '" placeholder="e.g. jsmith" data-field-key="username" data-change="admin-draft-field"></div>';
    h += '<div class="frow"><label class="flbl">Display Name</label>';
    h += '<input class="finp" value="' + esc(S.adminDraft.displayName || '') + '" placeholder="Jane Smith" data-field-key="displayName" data-change="admin-draft-field"></div>';
    h += '<div class="frow"><label class="flbl">Password</label>';
    h += '<div style="display:flex;gap:8px;align-items:flex-start">';
    h += '<input class="finp" type="' + (S.adminDraft.passwordVisible ? 'text' : 'password') + '" value="' + esc(S.adminDraft.password || '') + '" placeholder="Temporary password" data-field-key="password" data-change="admin-draft-field" style="flex:1">';
    h += '<button class="hbtn sm" type="button" data-action="admin-generate-password">Generate</button>';
    h += '</div>';
    if (S.adminDraft.passwordVisible && S.adminDraft.password) {
      h += '<div style="font-size:10px;color:var(--accent);margin-top:4px">Share this password with the user. It will not be shown again.</div>';
    }
    h += '</div>';
    h += '<div class="frow"><label class="flbl">Email</label>';
    h += '<input class="finp" type="email" value="' + esc(S.adminDraft.email || '') + '" placeholder="user@example.com" data-field-key="email" data-change="admin-draft-field"></div>';
    h += '<div class="frow"><label class="flbl">Role</label>';
    h += '<select class="finp" data-change="admin-draft-role">';
    h += '<option value="attorney"' + (S.adminDraft.role !== 'admin' ? ' selected' : '') + '>Attorney</option>';
    h += '<option value="admin"' + (S.adminDraft.role === 'admin' ? ' selected' : '') + '>Admin</option>';
    h += '</select></div>';
    h += '<div id="admin-create-error" class="login-error" style="display:none;margin-top:8px"></div>';
    h += '<div class="dir-card-actions">';
    h += '<button class="hbtn accent" data-action="admin-create-user" id="admin-create-btn">Create Account</button>';
    h += '<button class="hbtn" data-action="admin-cancel-create">Cancel</button></div>';
    h += '</div>';
  }

  // Split users into managed and unmanaged
  var userList = Object.values(S.users);
  var managedUsers = userList.filter(function(u) { return u.managed !== false; });
  var unmanagedUsers = userList.filter(function(u) { return u.managed === false; });

  managedUsers.sort(function(a, b) {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
  unmanagedUsers.sort(function(a, b) {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  // Managed users section
  h += '<div class="dir-list">';
  if (managedUsers.length === 0 && unmanagedUsers.length === 0) {
    h += '<div class="dir-empty">No users found.</div>';
  }
  managedUsers.forEach(function(u) {
    var isEditing = S.adminEditUserId === u.mxid;
    h += '<div class="dir-card' + (isEditing ? ' editing' : '') + '">';
    if (isEditing) {
      h += '<div class="fg-title" style="margin-bottom:12px;font-weight:600">Edit User</div>';
      h += '<div class="frow"><label class="flbl">Display Name</label>';
      h += '<input class="finp" value="' + esc(S.adminDraft.displayName || '') + '" data-field-key="displayName" data-change="admin-draft-field"></div>';
      h += '<div class="frow"><label class="flbl">Email</label>';
      h += '<input class="finp" type="email" value="' + esc(S.adminDraft.email || '') + '" placeholder="user@example.com" data-field-key="email" data-change="admin-draft-field"></div>';
      h += '<div class="frow"><label class="flbl">Role</label>';
      h += '<select class="finp" data-change="admin-draft-role">';
      h += '<option value="attorney"' + (S.adminDraft.role !== 'admin' ? ' selected' : '') + '>Attorney</option>';
      h += '<option value="admin"' + (S.adminDraft.role === 'admin' ? ' selected' : '') + '>Admin</option>';
      h += '</select></div>';
      h += '<div class="frow"><label class="flbl">Reset Password</label>';
      h += '<div style="display:flex;gap:8px;align-items:flex-start">';
      h += '<input class="finp" type="' + (S.adminDraft.passwordVisible ? 'text' : 'password') + '" value="' + esc(S.adminDraft.password || '') + '" placeholder="Leave blank to keep current" data-field-key="password" data-change="admin-draft-field" style="flex:1">';
      h += '<button class="hbtn sm" type="button" data-action="admin-generate-password">Generate</button>';
      h += '</div>';
      if (S.adminDraft.passwordVisible && S.adminDraft.password) {
        h += '<div style="font-size:10px;color:var(--accent);margin-top:4px">Share this password with the user. It will not be shown again.</div>';
      }
      h += '</div>';
      h += '<div id="admin-edit-error" class="login-error" style="display:none;margin-top:8px"></div>';
      h += '<div class="dir-card-actions">';
      h += '<button class="hbtn accent" data-action="admin-save-user">Save Changes</button>';
      h += '<button class="hbtn" data-action="admin-cancel-edit">Cancel</button>';
      if (u.mxid !== S.currentUser) {
        h += '<button class="hbtn danger" data-action="admin-deactivate-user" data-mxid="' + esc(u.mxid) + '">Deactivate</button>';
      }
      h += '</div>';
    } else {
      var roleBadgeColor = u.role === 'admin' ? '#a08540' : '#8a8a9a';
      h += '<div class="dir-card-head" data-action="admin-edit-user" data-mxid="' + esc(u.mxid) + '">';
      h += '<strong>' + esc(u.displayName) + '</strong>';
      h += '<span class="dir-card-sub" style="color:' + roleBadgeColor + ';font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.5px">' + esc(u.role) + '</span>';
      if (u.synapseAdmin) {
        h += '<span class="dir-card-sub" style="color:#a08540;font-size:9px;margin-left:6px">SERVER ADMIN</span>';
      }
      h += '</div>';
      h += '<div class="dir-card-detail">' + esc(u.mxid) + '</div>';
      if (u.email) {
        h += '<div class="dir-card-detail">' + esc(u.email) + '</div>';
      }
      if (!u.active) {
        h += '<div class="dir-card-detail" style="color:#b91c1c;font-weight:600">DEACTIVATED</div>';
      }
      h += htmlProvenanceBadge(u);
      // Send/Resend credentials button
      if (u.active && u.email) {
        h += '<div style="margin-top:6px"><button class="hbtn sm" data-action="admin-resend-credentials" data-mxid="' + esc(u.mxid) + '">Resend Credentials</button></div>';
      }
    }
    h += '</div>';
  });
  h += '</div>';

  // Unmanaged server users section
  if (unmanagedUsers.length > 0) {
    h += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">';
    h += '<div class="dir-head"><h3>Unmanaged Server Users</h3></div>';
    h += '<p class="dir-desc">These users exist on the Matrix server but have not been assigned a role in this application. Click to adopt them.</p>';
    h += '<div class="dir-list">';
    unmanagedUsers.forEach(function(u) {
      var isEditing = S.adminEditUserId === u.mxid;
      h += '<div class="dir-card' + (isEditing ? ' editing' : '') + '">';
      if (isEditing) {
        h += '<div class="fg-title" style="margin-bottom:12px;font-weight:600">Adopt User</div>';
        h += '<div class="frow"><label class="flbl">Display Name</label>';
        h += '<input class="finp" value="' + esc(S.adminDraft.displayName || '') + '" data-field-key="displayName" data-change="admin-draft-field"></div>';
        h += '<div class="frow"><label class="flbl">Email</label>';
        h += '<input class="finp" type="email" value="' + esc(S.adminDraft.email || '') + '" placeholder="user@example.com" data-field-key="email" data-change="admin-draft-field"></div>';
        h += '<div class="frow"><label class="flbl">Role</label>';
        h += '<select class="finp" data-change="admin-draft-role">';
        h += '<option value="attorney"' + (S.adminDraft.role !== 'admin' ? ' selected' : '') + '>Attorney</option>';
        h += '<option value="admin"' + (S.adminDraft.role === 'admin' ? ' selected' : '') + '>Admin</option>';
        h += '</select></div>';
        h += '<div class="frow"><label class="flbl">Set Password</label>';
        h += '<div style="display:flex;gap:8px;align-items:flex-start">';
        h += '<input class="finp" type="' + (S.adminDraft.passwordVisible ? 'text' : 'password') + '" value="' + esc(S.adminDraft.password || '') + '" placeholder="Optional \u2014 generate or type" data-field-key="password" data-change="admin-draft-field" style="flex:1">';
        h += '<button class="hbtn sm" type="button" data-action="admin-generate-password">Generate</button>';
        h += '</div>';
        if (S.adminDraft.passwordVisible && S.adminDraft.password) {
          h += '<div style="font-size:10px;color:var(--accent);margin-top:4px">Share this password with the user. It will not be shown again.</div>';
        }
        h += '</div>';
        h += '<div id="admin-adopt-error" class="login-error" style="display:none;margin-top:8px"></div>';
        h += '<div class="dir-card-actions">';
        h += '<button class="hbtn accent" data-action="admin-adopt-user" data-mxid="' + esc(u.mxid) + '">Adopt User</button>';
        h += '<button class="hbtn" data-action="admin-cancel-edit">Cancel</button></div>';
      } else {
        h += '<div class="dir-card-head" data-action="admin-edit-user" data-mxid="' + esc(u.mxid) + '">';
        h += '<strong>' + esc(u.displayName) + '</strong>';
        h += '<span class="dir-card-sub" style="color:#b45309;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.5px">UNMANAGED</span>';
        if (u.synapseAdmin) {
          h += '<span class="dir-card-sub" style="color:#a08540;font-size:9px;margin-left:6px">SERVER ADMIN</span>';
        }
        h += '</div>';
        h += '<div class="dir-card-detail">' + esc(u.mxid) + '</div>';
        if (!u.active) {
          h += '<div class="dir-card-detail" style="color:#b91c1c;font-weight:600">DEACTIVATED</div>';
        }
        if (u.creationTs) {
          h += '<div class="prov"><span class="prov-item">Created ' + ts(new Date(u.creationTs * 1000).toISOString()) + '</span></div>';
        }
      }
      h += '</div>';
    });
    h += '</div></div>';
  }

  h += '</div></div></div>';
  return h;
}

// ── Filing Panel (Guided Handoff) ────────────────────────────────
function renderFilingPanel(pet, client) {
  var h = '';
  if (!pet) return h;
  var rdns = computeReadiness(pet, client || {});
  var pct = Math.round(rdns.score * 100);
  var selectedCourt = pet._courtId ? S.courts[pet._courtId] : null;
  var courtLabel = selectedCourt ? (selectedCourt.district || '') + (selectedCourt.division ? ' \u2014 ' + selectedCourt.division : '') : '';
  var isFilingStage = pet.stage === 'filing';

  if (!isFilingStage) {
    var stageLabel = SM[pet.stage] ? SM[pet.stage].label : pet.stage;
    h += '<div class="filing-not-ready">';
    h += '<p>This matter is currently in <strong>' + esc(stageLabel) + '</strong> stage.</p>';
    h += '<p>Advance to <strong>Filing</strong> to begin the court submission process.</p>';
    h += '</div>';
    // Still show checklist summary
    h += '<div class="fg"><div class="fg-title">Readiness Overview</div>';
  } else {
    h += '<div class="fg"><div class="fg-title">Filing Checklist</div>';
  }

  // Checklist items
  rdns.items.forEach(function(it) {
    var icon = it.ok ? '<span class="filing-check-ok">\u2713</span>' : '<span class="filing-check-miss">\u2717</span>';
    h += '<div class="filing-check-item">' + icon + ' <span>' + esc(it.label) + '</span></div>';
  });

  // Progress bar
  h += '<div class="filing-progress-wrap">';
  h += '<div class="filing-progress-label">' + rdns.done + ' of ' + rdns.total + ' complete</div>';
  h += '<div class="filing-progress"><div class="filing-progress-bar" style="width:' + pct + '%"></div></div>';
  h += '<div class="filing-progress-pct">' + pct + '%</div>';
  h += '</div></div>';

  if (isFilingStage) {
    // Export section
    h += '<div class="filing-section"><div class="fg-title">Export Documents</div>';
    h += '<div class="filing-export-btns">';
    h += '<button class="hbtn accent" data-action="export-word">DOCX \u2193</button>';
    h += '<button class="hbtn" data-action="export-pdf">PDF \u2193</button>';
    h += '</div>';
    if (pet._exported) {
      h += '<div class="filing-check-item"><span class="filing-check-ok">\u2713</span> <span>Document exported</span></div>';
    } else {
      h += '<div class="filing-check-item"><span class="filing-check-miss">\u2717</span> <span>Export required before filing</span></div>';
    }
    h += '</div>';

    // Court portal section
    if (selectedCourt) {
      h += '<div class="filing-section"><div class="fg-title">Court Portal</div>';
      h += '<div class="filing-court-name">' + esc(courtLabel) + '</div>';
      if (selectedCourt.ecfUrl || selectedCourt.website) {
        h += '<a href="' + esc(selectedCourt.ecfUrl || selectedCourt.website) + '" target="_blank" rel="noopener" class="hbtn accent filing-portal-btn">Open CM/ECF Portal &#8599;</a>';
      }
      if (selectedCourt.pacerUrl) {
        h += '<a href="' + esc(selectedCourt.pacerUrl) + '" target="_blank" rel="noopener" class="hbtn filing-portal-btn">Open PACER &#8599;</a>';
      }
      h += '</div>';
    } else {
      h += '<div class="filing-section"><div class="fg-title">Court Portal</div>';
      h += '<p class="filing-no-court">No court assigned. Go to Court + Facility tab to select one.</p>';
      h += '</div>';
    }

    // Confirm filing section
    h += '<div class="filing-section filing-confirm"><div class="fg-title">Confirm Filing</div>';
    h += '<div class="frow"><label class="flbl">Case Number</label>';
    h += '<input type="text" class="finp" value="' + esc(pet.caseNumber || '') + '" data-field-key="caseNumber" data-change="filing-case-number" placeholder="Enter case number after filing"></div>';
    var canMarkFiled = !!(pet.caseNumber && pet.caseNumber.trim() && pet._exported);
    h += '<button class="hbtn accent filing-mark-btn" data-action="mark-as-filed" data-id="' + pet.id + '"' + (canMarkFiled ? '' : ' disabled') + '>Mark as Filed \u2713</button>';
    if (!canMarkFiled) {
      var reasons = [];
      if (!pet.caseNumber || !pet.caseNumber.trim()) reasons.push('case number');
      if (!pet._exported) reasons.push('document export');
      h += '<p class="filing-note">Requires: ' + reasons.join(', ') + '</p>';
    }
    h += '</div>';
  }

  return h;
}

function renderEditor() {
  var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
  if (!pet) {
    return '<div class="editor-view"><div style="flex:1;display:flex;align-items:center;justify-content:center;color:#aaa">No matter selected.</div></div>';
  }
  var client = S.clients[pet.clientId] || null;
  var att1 = pet._att1Id ? S.attProfiles[pet._att1Id] : null;
  var att2 = pet._att2Id ? S.attProfiles[pet._att2Id] : null;
  var vars = buildVarMap(client || {}, pet, att1 || {}, att2 || {}, S.national);
  var caseNo = (pet.caseNumber && pet.caseNumber.trim()) ? 'C/A No. ' + pet.caseNumber : '';

  var h = '<div class="editor-view"><div class="ed-sidebar"><div class="ed-tabs">';
  [['client','Client'],['court','Court + Facility'],['atty','Attorneys'],['details','Details'],['page','Page'],['filing','Filing'],['log','Log (' + S.log.length + ')']].forEach(function(t) {
    h += '<button class="ed-tab' + (S.editorTab === t[0] ? ' on' : '') + '" data-action="ed-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
  });
  h += '</div><div class="ed-fields">';

  if (S.editorTab === 'client' && client) {
    h += htmlFieldGroup('Client (shared)', CLIENT_FIELDS, client, 'editor-client-field');
  }

  if (S.editorTab === 'court') {
    var courtDisplayFn = function(c) { return c.district + (c.division ? ' \u2014 ' + c.division : '') + (c.circuit ? ' (Cir. ' + c.circuit + ')' : ''); };
    var courtItems = sortByFrequency(Object.values(S.courts).filter(function(c) { return !c.archived; }), countPetitionFieldUsage('_courtId'), courtDisplayFn);
    h += htmlPicker('Select Court', courtItems, courtDisplayFn, pet._courtId || '', 'apply-court', 'inline-add-court');
    if (S.inlineAdd && S.inlineAdd.type === 'court') {
      h += htmlInlineAddForm('court');
    }
    var selectedCourt = pet._courtId ? S.courts[pet._courtId] : null;
    if (selectedCourt && (selectedCourt.ecfUrl || selectedCourt.website || selectedCourt.pacerUrl)) {
      h += '<div class="ed-court-links">';
      if (selectedCourt.ecfUrl || selectedCourt.website) h += '<a href="' + esc(selectedCourt.ecfUrl || selectedCourt.website) + '" target="_blank" rel="noopener" class="dir-link">CM/ECF Portal &#8599;</a>';
      if (selectedCourt.pacerUrl) h += '<a href="' + esc(selectedCourt.pacerUrl) + '" target="_blank" rel="noopener" class="dir-link">PACER &#8599;</a>';
      h += '</div>';
    }
    h += htmlFieldGroup('Court (manual override)', COURT_FIELDS, pet, 'editor-pet-field');
    h += '<div style="height:8px"></div>';
    var facDisplayFn = function(f) { return f.name + ' \u2014 ' + f.city + ', ' + f.state; };
    var facItems = sortByFrequency(Object.values(S.facilities).filter(function(f) { return !f.archived; }), countPetitionFieldUsage('_facilityId'), facDisplayFn);
    h += htmlPicker('Select Facility', facItems, facDisplayFn, pet._facilityId || '', 'apply-facility', 'inline-add-facility');
    if (S.inlineAdd && S.inlineAdd.type === 'facility') {
      h += htmlInlineAddForm('facility');
    }
    h += htmlFieldGroup('Facility (manual override)', FACILITY_FIELDS, pet, 'editor-pet-field');
    h += htmlFieldGroup('Respondents (manual override)', RESPONDENT_FIELDS, pet, 'editor-pet-field');
    h += htmlFieldGroup('National Officials (override)', NATIONAL_OVERRIDE_FIELDS, pet, 'editor-pet-field');
  }

  if (S.editorTab === 'atty') {
    var attDisplayFn = function(a) { return a.name + ' \u2014 ' + a.firm; };
    var attAll = Object.values(S.attProfiles).filter(function(a) { return !a.archived; });
    var attFiltered = S.role === 'admin' ? attAll : attAll.filter(function(a) { return a.createdBy === S.currentUser; });
    var attList = sortByFrequency(attFiltered, countAttorneyUsage(), attDisplayFn);
    h += htmlPicker('Attorney 1', attList, attDisplayFn, pet._att1Id || '', 'apply-att1', 'inline-add-att1');
    if (S.inlineAdd && S.inlineAdd.type === 'att1') {
      h += htmlInlineAddForm('att1');
    }
    h += htmlPicker('Attorney 2', attList, attDisplayFn, pet._att2Id || '', 'apply-att2', 'inline-add-att2');
    if (S.inlineAdd && S.inlineAdd.type === 'att2') {
      h += htmlInlineAddForm('att2');
    }
    if (!pet._att1Id && !pet._att2Id && !S.inlineAdd) {
      h += '<p style="font-size:11px;color:#aaa;margin-top:8px">Select attorney profiles from the Directory, or add new ones with +</p>';
    }
  }

  if (S.editorTab === 'details') {
    h += htmlFieldGroup('Filing Details', FILING_FIELDS, pet, 'editor-pet-field');
  }

  if (S.editorTab === 'page') {
    var ps = pet.pageSettings || DEFAULT_PAGE_SETTINGS;
    h += '<div class="fg"><div class="fg-title">Header</div>';
    h += '<div class="frow"><label class="flbl">Left</label>';
    h += '<input type="text" class="finp" value="' + esc(ps.headerLeft) + '" data-field-key="headerLeft" data-change="page-settings"></div>';
    h += '<div class="frow"><label class="flbl">Center</label>';
    h += '<input type="text" class="finp" value="' + esc(ps.headerCenter) + '" data-field-key="headerCenter" data-change="page-settings"></div>';
    h += '<div class="frow"><label class="flbl">Right</label>';
    h += '<input type="text" class="finp" value="' + esc(ps.headerRight) + '" data-field-key="headerRight" data-change="page-settings"></div>';
    h += '<div class="frow"><label class="flbl">First Page</label>';
    h += '<select class="finp" data-field-key="showHeaderOnFirstPage" data-change="page-settings">';
    h += '<option value="false"' + (!ps.showHeaderOnFirstPage ? ' selected' : '') + '>Hide on first page</option>';
    h += '<option value="true"' + (ps.showHeaderOnFirstPage ? ' selected' : '') + '>Show on first page</option>';
    h += '</select></div></div>';

    h += '<div class="fg"><div class="fg-title">Footer</div>';
    h += '<div class="frow"><label class="flbl">Left</label>';
    h += '<input type="text" class="finp" value="' + esc(ps.footerLeft) + '" data-field-key="footerLeft" data-change="page-settings"></div>';
    h += '<div class="frow"><label class="flbl">Center</label>';
    h += '<input type="text" class="finp" value="' + esc(ps.footerCenter) + '" data-field-key="footerCenter" data-change="page-settings"></div>';
    h += '<div class="frow"><label class="flbl">Right</label>';
    h += '<input type="text" class="finp" value="' + esc(ps.footerRight) + '" data-field-key="footerRight" data-change="page-settings"></div>';
    h += '<div class="frow"><label class="flbl">First Page</label>';
    h += '<select class="finp" data-field-key="showFooterOnFirstPage" data-change="page-settings">';
    h += '<option value="true"' + (ps.showFooterOnFirstPage ? ' selected' : '') + '>Show on first page</option>';
    h += '<option value="false"' + (!ps.showFooterOnFirstPage ? ' selected' : '') + '>Hide on first page</option>';
    h += '</select></div></div>';

    h += '<p style="font-size:10px;color:#aaa;margin-top:8px">Variables: <code>{{CASE_NUMBER}}</code> for case no., <code>{{PAGE}}</code> for "Page X of Y", <code>{{PAGE_NUM}}</code> for number only.</p>';
  }

  if (S.editorTab === 'filing') {
    h += renderFilingPanel(pet, client);
  }

  if (S.editorTab === 'log') {
    h += '<div class="lscroll">';
    if (S.log.length === 0) h += '<div class="lempty">No operations yet.</div>';
    var logColors = { FILL:'#5aa06f', REVISE:'#c9a040', CREATE:'#7a70c0', STAGE:'#4a7ab5', APPLY:'#60a0d0', UPDATE:'#a08540', DELETE:'#c05050', ARCHIVE:'#8b6914', RECOVER:'#5a9e6f' };
    S.log.forEach(function(e, i) {
      h += '<div class="lentry"><span class="lts">' + new Date(e.frame.t).toLocaleTimeString('en-US', {hour12:false}) + '</span> ';
      h += '<span style="color:' + (logColors[e.op] || '#888') + ';font-weight:600">' + e.op + '</span>';
      h += '<span class="ld">(</span><span class="lt">' + esc(e.target) + '</span>';
      if (e.payload != null) {
        var pStr = typeof e.payload === 'string' ? '"' + e.payload.slice(0, 25) + (e.payload.length > 25 ? '\u2026' : '') + '"' : '\u2026';
        h += '<span class="ld">, </span><span class="lp">' + esc(pStr) + '</span>';
      }
      h += '<span class="ld">)</span></div>';
    });
    h += '</div>';
  }

  // Archive/recover button for petition
  var canArchivePet = S.role === 'admin' || pet.createdBy === S.currentUser;
  if (canArchivePet) {
    h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
    if (pet.archived) {
      h += '<span class="archived-badge">Archived</span> ';
      h += '<button class="hbtn accent sm" data-action="recover-petition" data-id="' + pet.id + '">Recover Matter</button>';
    } else {
      h += '<button class="hbtn danger sm" data-action="archive-petition" data-id="' + pet.id + '">Archive Matter</button>';
    }
    h += '</div>';
  }

  h += '</div></div>';

  // Document area
  h += '<div class="doc-scroll" id="doc-scroll">';
  h += renderPaginatedDoc(pet.blocks, vars, caseNo, pet.pageSettings);
  h += '<div style="height:60px;flex-shrink:0"></div>';
  h += '</div></div>';
  return h;
}

function renderPaginatedDoc(blocks, vars, caseNo, pageSettings) {
  var body = blocks.filter(function(b) { return !CAP_ALL[b.id]; });
  var capBlocks = blocks.filter(function(b) { return TITLE_IDS[b.id]; });
  var capLBlocks = blocks.filter(function(b) { return CAP_L.indexOf(b.id) >= 0; });
  var capRBlocks = blocks.filter(function(b) { return CAP_R.indexOf(b.id) >= 0; });

  var PAGE_W = 816, PAGE_H = 1056, MG = 96;

  function renderBlock(b, editable) {
    var cls = CLS_MAP[b.type] || 'blk-para';
    var ce = editable ? ' contenteditable="true"' : '';
    return '<div class="blk ' + cls + '" data-block-id="' + b.id + '"' + ce + '>' + blockToHtml(b.content, vars) + '</div>';
  }

  function renderCaption(editable) {
    var c = '';
    capBlocks.forEach(function(b) { c += renderBlock(b, editable); });
    c += '<div class="caption-grid"><div class="cap-left-col">';
    capLBlocks.forEach(function(b) { c += renderBlock(b, editable); });
    c += '</div><div class="cap-mid-col">';
    for (var i = 0; i < 24; i++) c += '<div>)</div>';
    c += '</div><div class="cap-right-col">';
    capRBlocks.forEach(function(b) { c += renderBlock(b, editable); });
    c += '</div></div>';
    return c;
  }

  // Measurement pass (offscreen) + page shells
  // We do a simple approach: render all blocks then paginate after mount
  var USABLE_H = PAGE_H - 2 * MG - 28;

  var h = '<div class="measure-box" id="measure-box" style="width:' + (PAGE_W - 2 * MG) + 'px" aria-hidden="true">';
  h += '<div data-mr="cap">' + renderCaption(false) + '</div>';
  h += '<div data-mr="body">';
  body.forEach(function(b) { h += renderBlock(b, false); });
  h += '</div></div>';

  // Initial single page - will be repaginated by initPagination()
  var ips = pageSettings || DEFAULT_PAGE_SETTINGS;
  h += '<div id="pages-container">';
  h += '<div class="page-shell"><div class="page-paper" style="width:' + PAGE_W + 'px;height:' + PAGE_H + 'px">';
  h += '<div class="page-margin" style="padding:' + MG + 'px;padding-bottom:0">';
  h += renderCaption(true);
  body.forEach(function(b) { h += renderBlock(b, true); });
  h += '</div>';
  if (ips.footerLeft || ips.footerCenter || ips.footerRight) {
    h += '<div class="page-foot" style="height:' + MG + 'px;padding:12px ' + MG + 'px 0"><span>' + esc(caseNo) + '</span><span></span><span>Page 1 of 1</span></div>';
  }
  h += '</div></div>';
  h += '</div>';

  return h;
}

// ── Pagination after mount ───────────────────────────────────────
function initPagination() {
  var mb = document.getElementById('measure-box');
  var pc = document.getElementById('pages-container');
  if (!mb || !pc) return;

  var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
  if (!pet) return;
  var client = S.clients[pet.clientId] || null;
  var att1 = pet._att1Id ? S.attProfiles[pet._att1Id] : null;
  var att2 = pet._att2Id ? S.attProfiles[pet._att2Id] : null;
  var vars = buildVarMap(client || {}, pet, att1 || {}, att2 || {}, S.national);
  var caseNo = (pet.caseNumber && pet.caseNumber.trim()) ? 'C/A No. ' + pet.caseNumber : '';
  var blocks = pet.blocks;
  var body = blocks.filter(function(b) { return !CAP_ALL[b.id]; });

  var PAGE_W = 816, PAGE_H = 1056, MG = 96, USABLE_H = PAGE_H - 2 * MG - 28;

  var capEl = mb.querySelector('[data-mr="cap"]');
  var capH = capEl ? capEl.offsetHeight : 0;
  var blockEls = Array.from(mb.querySelectorAll('[data-mr="body"]>[data-block-id]'));
  var hs = blockEls.map(function(e) {
    var cs = window.getComputedStyle(e);
    var mt = parseFloat(cs.marginTop) || 0;
    var mbot = parseFloat(cs.marginBottom) || 0;
    return {
      id: e.dataset.blockId,
      h: e.offsetHeight + mt + mbot,
      isHeading: e.className.indexOf('blk-heading') >= 0
    };
  });

  var pages = [];
  var cur = [];
  var rem = USABLE_H - capH;
  var pi = 0;
  for (var i = 0; i < hs.length; i++) {
    var item = hs[i];
    if (item.h > rem && cur.length > 0) {
      pages.push({ ids: cur, first: pi === 0 });
      cur = []; rem = USABLE_H; pi++;
    }
    // Heading orphan prevention: if heading fits but heading + next block doesn't,
    // push heading to next page so it stays with its content
    if (item.isHeading && cur.length > 0 && i + 1 < hs.length) {
      var nextH = hs[i + 1].h;
      if (item.h <= rem && item.h + nextH > rem) {
        pages.push({ ids: cur, first: pi === 0 });
        cur = []; rem = USABLE_H; pi++;
      }
    }
    cur.push(item.id);
    rem -= item.h;
  }
  if (cur.length > 0 || pages.length === 0) {
    pages.push({ ids: cur, first: pi === 0 });
  }

  var bm = {};
  blocks.forEach(function(b) { bm[b.id] = b; });
  var total = pages.length || 1;

  function renderBlock(b, editable) {
    var cls = CLS_MAP[b.type] || 'blk-para';
    var ce = editable ? ' contenteditable="true"' : '';
    return '<div class="blk ' + cls + '" data-block-id="' + b.id + '"' + ce + '>' + blockToHtml(b.content, vars) + '</div>';
  }

  function renderCaption(editable) {
    var capBlocks = blocks.filter(function(b) { return TITLE_IDS[b.id]; });
    var capLBlocks = blocks.filter(function(b) { return CAP_L.indexOf(b.id) >= 0; });
    var capRBlocks = blocks.filter(function(b) { return CAP_R.indexOf(b.id) >= 0; });
    var c = '';
    capBlocks.forEach(function(b) { c += renderBlock(b, editable); });
    c += '<div class="caption-grid"><div class="cap-left-col">';
    capLBlocks.forEach(function(b) { c += renderBlock(b, editable); });
    c += '</div><div class="cap-mid-col">';
    for (var i = 0; i < 24; i++) c += '<div>)</div>';
    c += '</div><div class="cap-right-col">';
    capRBlocks.forEach(function(b) { c += renderBlock(b, editable); });
    c += '</div></div>';
    return c;
  }

  var ps = pet.pageSettings || DEFAULT_PAGE_SETTINGS;

  function resolvePageVar(text, pageNum, totalPages, cn) {
    if (!text) return '';
    return text
      .replace(/\{\{PAGE\}\}/g, 'Page ' + pageNum + ' of ' + totalPages)
      .replace(/\{\{PAGE_NUM\}\}/g, String(pageNum))
      .replace(/\{\{TOTAL_PAGES\}\}/g, String(totalPages))
      .replace(/\{\{CASE_NUMBER\}\}/g, cn);
  }

  var html = '';
  pages.forEach(function(pg, idx) {
    var pageNum = idx + 1;
    var isFirst = idx === 0;

    var hasHeaderContent = ps.headerLeft || ps.headerCenter || ps.headerRight;
    var hasFooterContent = ps.footerLeft || ps.footerCenter || ps.footerRight;
    var showHeader = hasHeaderContent && (!isFirst || ps.showHeaderOnFirstPage);
    var showFooter = hasFooterContent && (!isFirst || ps.showFooterOnFirstPage);

    html += '<div class="page-shell"><div class="page-paper" style="width:' + PAGE_W + 'px;height:' + PAGE_H + 'px">';

    if (showHeader) {
      html += '<div class="page-head" style="height:' + MG + 'px;padding:0 ' + MG + 'px 12px">';
      html += '<span>' + esc(resolvePageVar(ps.headerLeft, pageNum, total, caseNo)) + '</span>';
      html += '<span>' + esc(resolvePageVar(ps.headerCenter, pageNum, total, caseNo)) + '</span>';
      html += '<span>' + esc(resolvePageVar(ps.headerRight, pageNum, total, caseNo)) + '</span>';
      html += '</div>';
    }

    html += '<div class="page-margin" style="padding:' + MG + 'px;padding-bottom:0">';
    if (pg.first) html += renderCaption(true);
    pg.ids.forEach(function(id) {
      var b = bm[id];
      if (b) html += renderBlock(b, true);
    });
    html += '</div>';

    if (showFooter) {
      html += '<div class="page-foot" style="height:' + MG + 'px;padding:12px ' + MG + 'px 0">';
      html += '<span>' + esc(resolvePageVar(ps.footerLeft, pageNum, total, caseNo)) + '</span>';
      html += '<span>' + esc(resolvePageVar(ps.footerCenter, pageNum, total, caseNo)) + '</span>';
      html += '<span>' + esc(resolvePageVar(ps.footerRight, pageNum, total, caseNo)) + '</span>';
      html += '</div>';
    }

    html += '</div></div>';
  });

  pc.innerHTML = html;
  attachBlockListeners();
}

function attachBlockListeners() {
  var pc = document.getElementById('pages-container');
  if (!pc) return;
  var editingBlocks = {};

  pc.querySelectorAll('.blk[contenteditable="true"]').forEach(function(el) {
    el.addEventListener('focus', function() {
      editingBlocks[el.dataset.blockId] = true;
    });
    el.addEventListener('blur', function() {
      delete editingBlocks[el.dataset.blockId];
      var bid = el.dataset.blockId;
      var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
      if (!pet) return;
      if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;
      var block = pet.blocks.find(function(b) { return b.id === bid; });
      if (!block) return;
      var nc = extractBlockContent(el);
      var norm = function(s) { return s.replace(/\s+/g, ' ').trim(); };
      if (norm(nc) !== norm(block.content)) {
        var newBlocks = pet.blocks.map(function(b) {
          return b.id === bid ? { id: b.id, type: b.type, content: nc } : b;
        });
        S.petitions[pet.id] = Object.assign({}, pet, { blocks: newBlocks, _bodyEdited: true });
        S.log.push({ op: 'REVISE', target: bid, payload: nc, frame: { t: now(), prior: block.content, petition: pet.id } });
        // Sync to matrix
        if (matrix.isReady() && pet.roomId) {
          matrix.sendStateEvent(pet.roomId, EVT_PETITION_BLOCKS, { blocks: newBlocks }, pet.id).catch(function(e) { console.error('Block sync failed:', e); toast('ALT \u21CC block sync failed', 'error'); });
        }
      }
      // Re-render the HTML with vars
      var client = S.clients[pet.clientId] || {};
      var att1 = pet._att1Id ? S.attProfiles[pet._att1Id] : null;
      var att2 = pet._att2Id ? S.attProfiles[pet._att2Id] : null;
      var vars = buildVarMap(client, pet, att1 || {}, att2 || {}, S.national);
      var actualBlock = S.petitions[pet.id].blocks.find(function(b) { return b.id === bid; });
      if (actualBlock) el.innerHTML = blockToHtml(actualBlock.content, vars);
    });
  });
}

// ── Password Change Modal ────────────────────────────────────────
function renderPasswordChangeModal() {
  var h = '<div class="pw-modal-overlay" data-action="pw-modal-close">';
  h += '<div class="pw-modal" onclick="event.stopPropagation()">';
  h += '<div class="pw-modal-title">Change Password</div>';
  h += '<form id="pw-change-form">';
  h += '<div class="frow"><label class="flbl">Current Password</label>';
  h += '<input class="finp" type="password" id="pw-current" autocomplete="current-password" required></div>';
  h += '<div class="frow"><label class="flbl">New Password</label>';
  h += '<input class="finp" type="password" id="pw-new" minlength="8" autocomplete="new-password" required></div>';
  h += '<div class="frow"><label class="flbl">Confirm New Password</label>';
  h += '<input class="finp" type="password" id="pw-confirm" minlength="8" autocomplete="new-password" required></div>';
  if (S.passwordChangeError) {
    h += '<div class="login-error" style="display:block;margin-top:8px">' + esc(S.passwordChangeError) + '</div>';
  }
  h += '<div class="dir-card-actions" style="margin-top:16px">';
  h += '<button class="hbtn accent" type="submit" id="pw-change-btn"' + (S.passwordChangeBusy ? ' disabled' : '') + '>' + (S.passwordChangeBusy ? 'Changing...' : 'Change Password') + '</button>';
  h += '<button class="hbtn" type="button" data-action="pw-modal-close">Cancel</button>';
  h += '</div></form></div></div>';
  return h;
}

function renderForcedPasswordChange() {
  var h = '<div class="loading-wrap" style="max-width:400px;margin:80px auto;padding:32px">';
  h += '<div class="pw-modal-title" style="margin-bottom:8px">Set Your Password</div>';
  h += '<p style="color:var(--fg2);font-size:13px;margin-bottom:20px">Your account was created by an administrator with a temporary password. Please choose a new password to continue.</p>';
  h += '<form id="forced-pw-form">';
  h += '<div class="frow"><label class="flbl">Temporary Password</label>';
  h += '<input class="finp" type="password" id="fpw-current" autocomplete="current-password" required></div>';
  h += '<div class="frow"><label class="flbl">New Password</label>';
  h += '<input class="finp" type="password" id="fpw-new" minlength="8" autocomplete="new-password" required></div>';
  h += '<div class="frow"><label class="flbl">Confirm New Password</label>';
  h += '<input class="finp" type="password" id="fpw-confirm" minlength="8" autocomplete="new-password" required></div>';
  if (S.passwordChangeError) {
    h += '<div class="login-error" style="display:block;margin-top:8px">' + esc(S.passwordChangeError) + '</div>';
  }
  h += '<div class="dir-card-actions" style="margin-top:16px">';
  h += '<button class="hbtn accent" type="submit" id="fpw-btn"' + (S.passwordChangeBusy ? ' disabled' : '') + '>' + (S.passwordChangeBusy ? 'Setting Password...' : 'Set Password') + '</button>';
  h += '</div></form></div>';
  return h;
}

// ── Main Render ──────────────────────────────────────────────────
function render() {
  var root = document.getElementById('root');
  if (!root) return;

  if (S.loading) {
    root.innerHTML = '<div class="loading-wrap"><div class="loading-text">Connecting...</div></div>';
    return;
  }

  if (!S.authenticated) {
    root.innerHTML = renderLogin();
    var form = document.getElementById('login-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
      });
    }
    var regForm = document.getElementById('register-form');
    if (regForm) {
      regForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleRegister();
      });
    }
    return;
  }

  var h = '<div class="root">';
  if (S.syncError) {
    h += '<div class="sync-banner">' + esc(S.syncError) + '<button data-action="dismiss-error" style="margin-left:12px;background:none;border:1px solid rgba(255,255,255,.4);color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px">Dismiss</button></div>';
  }
  // Force password change gate — blocks the main app until user sets a new password
  if (S.mustChangePassword) {
    root.innerHTML = renderForcedPasswordChange();
    var fpForm = document.getElementById('forced-pw-form');
    if (fpForm) {
      fpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleForcedPasswordChange();
      });
    }
    return;
  }

  h += renderHeader();
  if (S.currentView === 'board') h += renderBoard();
  else if (S.currentView === 'clients') h += renderClients();
  else if (S.currentView === 'directory') h += renderDirectory();
  else if (S.currentView === 'admin') h += renderAdmin();
  else if (S.currentView === 'editor') h += renderEditor();
  // Password change modal overlay
  if (S.showPasswordChange) h += renderPasswordChangeModal();
  h += '</div>';
  root.innerHTML = h;
  // Post-render: wire up password change form submit
  if (S.showPasswordChange) {
    var pwForm = document.getElementById('pw-change-form');
    if (pwForm) {
      pwForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handlePasswordChange();
      });
    }
  }

  // Post-render: pagination for editor
  if (S.currentView === 'editor') {
    requestAnimationFrame(function() { initPagination(); });
  }
  // Post-render: initialize kanban drag-and-drop
  if (S.currentView === 'board' && S.boardMode === 'kanban') {
    requestAnimationFrame(function() { initKanbanDragDrop(); });
  }
  // Post-render: initialize flatpickr date pickers and facility autocomplete
  requestAnimationFrame(function() { initDatePickers(); initFacilityAC(); });
}

// ── Kanban Drag-and-Drop ────────────────────────────────────────
function initKanbanDragDrop() {
  var dropZones = document.querySelectorAll('[data-drop-stage]');
  var cards = document.querySelectorAll('[data-drag-id]');

  cards.forEach(function(card) {
    card.addEventListener('dragstart', function(e) {
      // Don't drag when starting from action buttons
      if (e.target.closest && e.target.closest('.kb-card-actions')) {
        e.preventDefault();
        return;
      }
      _wasDragged = true;
      e.dataTransfer.setData('text/plain', card.dataset.dragId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('kb-dragging');
      // Highlight valid drop columns
      requestAnimationFrame(function() {
        dropZones.forEach(function(z) { z.classList.add('kb-drop-target'); });
      });
    });
    card.addEventListener('dragend', function() {
      card.classList.remove('kb-dragging');
      dropZones.forEach(function(z) {
        z.classList.remove('kb-drop-target');
        z.classList.remove('kb-drop-over');
      });
    });
  });

  dropZones.forEach(function(zone) {
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('kb-drop-over');
    });
    zone.addEventListener('dragleave', function(e) {
      // Only remove highlight when leaving the zone itself (not children)
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('kb-drop-over');
      }
    });
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('kb-drop-over');
      dropZones.forEach(function(z) { z.classList.remove('kb-drop-target'); });

      var petId = e.dataTransfer.getData('text/plain');
      var newStage = zone.dataset.dropStage;
      var pet = S.petitions[petId];
      if (!pet) return;
      if (pet.stage === newStage) return; // dropped in same column
      if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;

      // Stage gate: check requirements for advancing
      var oldIdx = STAGES.indexOf(pet.stage);
      var newIdx = STAGES.indexOf(newStage);
      if (newIdx > oldIdx) {
        // Check all intermediate gates when skipping stages
        for (var gi = oldIdx; gi < newIdx; gi++) {
          var client = S.clients[pet.clientId] || {};
          var gate = checkStageGate(pet, client, STAGES[gi], STAGES[gi + 1]);
          if (!gate.allowed) {
            toast('Missing: ' + gate.missing.join(', '), 'error');
            return;
          }
        }
      }

      var t = now();
      S.log.push({ op: 'STAGE', target: petId, payload: newStage, frame: { t: t, prior: pet.stage } });
      S.petitions[pet.id] = Object.assign({}, pet, { stage: newStage, stageHistory: pet.stageHistory.concat([{ stage: newStage, at: t }]) });
      if (matrix.isReady() && pet.roomId) {
        var stageLabel = SM[newStage] ? SM[newStage].label : newStage;
        syncPetitionToMatrix(S.petitions[pet.id], 'stage \u2192 ' + stageLabel);
      }
      render();
    });
  });
}

// ── Post-render Initializers ────────────────────────────────────
function initDatePickers() {
  if (typeof flatpickr === 'undefined') return;
  document.querySelectorAll('[data-flatpickr]').forEach(function(el) {
    if (el._flatpickr) return;
    var isFilingGroup = el.dataset.flatpickr === 'filing-group';
    flatpickr(el, {
      dateFormat: 'F j, Y',
      allowInput: true,
      onChange: function(dates, dateStr) {
        if (!dates.length) return;
        var d = dates[0];
        var formatted = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        el.value = formatted;
        var key = el.dataset.fieldKey;
        var action = el.dataset.change;
        dispatchFieldChange(action, key, formatted);
        if (isFilingGroup) {
          var day = d.getDate();
          var ordDay = toOrdinal(day);
          var monthYear = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
          dispatchFieldChange(action, 'filingDay', ordDay);
          dispatchFieldChange(action, 'filingMonthYear', monthYear);
          render();
        }
      }
    });
  });
}

function initFacilityAC() {
  var input = document.getElementById('fac-ac-input');
  var list = document.getElementById('fac-ac-list');
  if (!input || !list) return;
  if (input._acBound) return;
  input._acBound = true;

  input.addEventListener('input', function() {
    var q = input.value.trim().toLowerCase();
    if (q.length < 2) { list.style.display = 'none'; return; }
    var matches = ICE_FACILITY_SEEDS.filter(function(f) {
      return f.n.toLowerCase().indexOf(q) !== -1 ||
             f.c.toLowerCase().indexOf(q) !== -1 ||
             (stateAbbrToName(f.s)).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 10);
    if (matches.length === 0) { list.style.display = 'none'; return; }
    var h = '';
    matches.forEach(function(f, i) {
      h += '<div class="fac-ac-item" data-fac-idx="' + i + '" data-fac-n="' + esc(f.n) + '" data-fac-c="' + esc(f.c) + '" data-fac-s="' + esc(f.s) + '" data-fac-fo="' + esc(f.fo) + '">';
      h += '<div>' + esc(f.n) + '</div>';
      h += '<div class="fac-ac-sub">' + esc(f.c) + ', ' + esc(stateAbbrToName(f.s)) + ' \u00b7 ' + esc(f.fo) + '</div>';
      h += '</div>';
    });
    list.innerHTML = h;
    list.style.display = '';
  });

  list.addEventListener('click', function(e) {
    var item = e.target.closest('.fac-ac-item');
    if (!item) return;
    S.draft.name = item.dataset.facN;
    S.draft.city = item.dataset.facC;
    S.draft.state = stateAbbrToName(item.dataset.facS);
    S.draft.fieldOfficeName = item.dataset.facFo;
    list.style.display = 'none';
    input.value = '';
    render();
  });

  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.style.display = 'none';
    }
  });
}

// ── Event Handling (delegation) ──────────────────────────────────
function handleLogin() {
  var userEl = document.getElementById('login-user');
  var passEl = document.getElementById('login-pass');
  var errEl = document.getElementById('login-error');
  var btnEl = document.getElementById('login-btn');
  if (!userEl || !passEl) return;
  var username = userEl.value.trim();
  var password = passEl.value;
  if (!username || !password) return;

  btnEl.disabled = true;
  btnEl.textContent = 'Signing in...';
  errEl.style.display = 'none';

  matrix.login(CONFIG.MATRIX_SERVER_URL, username, password)
    .then(function() {
      // Login succeeded — show "Connecting..." while we sync and hydrate.
      // This prevents the "Signing in..." button from appearing stuck.
      S.authenticated = true;
      S.loading = true;
      render();
      return matrix.initialSync();
    })
    .then(function() {
      return hydrateFromMatrix();
    })
    .then(function() {
      S.loading = false;
      render();
      matrix.startLongPoll();
    })
    .catch(function(err) {
      // Reset auth state so the login form re-appears
      S.authenticated = false;
      S.loading = false;
      var status = (err && err.status) || 0;
      var msg;
      if (status === 502 || status === 503 || status === 504) {
        msg = 'Matrix server is unavailable (HTTP ' + status + '). Please try again later or check server status.';
      } else if (status === 0 || (err && err.errcode === 'M_NETWORK')) {
        msg = 'Cannot reach the Matrix server. Check your network connection and that the server is running.';
      } else {
        msg = (err && err.error) || (err && err.message) || 'Login failed. Check your credentials.';
      }
      render();
      // Show error on the freshly rendered login form
      setTimeout(function() {
        var newErrEl = document.getElementById('login-error');
        if (newErrEl) {
          newErrEl.textContent = msg;
          newErrEl.style.display = 'block';
        }
      }, 0);
    });
}

function handleRegister() {
  var emailEl = document.getElementById('register-email');
  var userEl = document.getElementById('register-user');
  var displayEl = document.getElementById('register-display');
  var passEl = document.getElementById('register-pass');
  var pass2El = document.getElementById('register-pass2');
  var errEl = document.getElementById('register-error');
  var btnEl = document.getElementById('register-btn');
  if (!emailEl || !userEl || !passEl || !pass2El) return;

  var email = emailEl.value.trim();
  var username = userEl.value.trim();
  var displayName = (displayEl ? displayEl.value.trim() : '') || username;
  var password = passEl.value;
  var password2 = pass2El.value;

  // Validate email domain
  if (!email) {
    errEl.textContent = 'Email is required.';
    errEl.style.display = 'block';
    return;
  }
  var emailDomain = email.split('@')[1];
  if (!emailDomain) {
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block';
    return;
  }
  var domainAllowed = false;
  for (var i = 0; i < CONFIG.ALLOWED_REGISTRATION_DOMAINS.length; i++) {
    if (emailDomain.toLowerCase() === CONFIG.ALLOWED_REGISTRATION_DOMAINS[i].toLowerCase()) {
      domainAllowed = true;
      break;
    }
  }
  if (!domainAllowed) {
    errEl.textContent = 'Registration is restricted to the following email domains: ' + CONFIG.ALLOWED_REGISTRATION_DOMAINS.join(', ');
    errEl.style.display = 'block';
    return;
  }

  if (!username) {
    errEl.textContent = 'Username is required.';
    errEl.style.display = 'block';
    return;
  }
  if (!/^[a-z0-9._=-]+$/.test(username)) {
    errEl.textContent = 'Username may only contain lowercase letters, numbers, dots, underscores, hyphens, and equals signs.';
    errEl.style.display = 'block';
    return;
  }
  if (!password || password.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.style.display = 'block';
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Passwords do not match.';
    errEl.style.display = 'block';
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = 'Creating account...';
  errEl.style.display = 'none';

  matrix.register(CONFIG.MATRIX_SERVER_URL, username, password, email)
    .then(function(data) {
      // Registration succeeded — now set display name
      var setDisplayName = Promise.resolve();
      if (displayName && displayName !== username) {
        setDisplayName = matrix._api('PUT', '/profile/' + encodeURIComponent(matrix.userId) + '/displayname', {
          displayname: displayName,
        }).catch(function(e) {
          console.warn('Failed to set display name:', e);
        });
      }
      return setDisplayName;
    })
    .then(function() {
      // Now login flow — sync and hydrate
      S.authenticated = true;
      S.loading = true;
      S._showRegister = false;
      render();
      return matrix.initialSync();
    })
    .then(function() {
      return hydrateFromMatrix();
    })
    .then(function() {
      S.loading = false;
      render();
      matrix.startLongPoll();
      toast('Account created successfully. Welcome!', 'success');
    })
    .catch(function(err) {
      S.authenticated = false;
      S.loading = false;
      var status = (err && err.status) || 0;
      var msg;
      if (err && err.errcode === 'M_USER_IN_USE') {
        msg = 'That username is already taken. Please choose a different one.';
      } else if (err && err.errcode === 'M_FORBIDDEN') {
        msg = 'Registration is not enabled on this server. Please contact your administrator.';
      } else if (err && err.errcode === 'M_INVALID_USERNAME') {
        msg = 'Invalid username. Use only lowercase letters, numbers, dots, underscores, and hyphens.';
      } else if (status === 502 || status === 503 || status === 504) {
        msg = 'Server is unavailable (HTTP ' + status + '). Please try again later.';
      } else if (status === 0 || (err && err.errcode === 'M_NETWORK')) {
        msg = 'Cannot reach the server. Check your network connection.';
      } else {
        msg = (err && err.error) || (err && err.message) || 'Registration failed. Please try again.';
      }
      render();
      setTimeout(function() {
        var newErrEl = document.getElementById('register-error');
        if (newErrEl) {
          newErrEl.textContent = msg;
          newErrEl.style.display = 'block';
        }
      }, 0);
    });
}

document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;

  if (action === 'nav') { cleanupInlineAdd(); setState({ currentView: btn.dataset.view, boardAddingMatter: false, inlineAdd: null, draft: {} }); return; }
  if (action === 'logout') { matrix.stopLongPoll(); matrix.clearSession(); setState({ authenticated: false, syncError: '' }); return; }
  if (action === 'dismiss-error') { setState({ syncError: '' }); return; }
  if (action === 'show-password-change') { setState({ showPasswordChange: true, passwordChangeError: '', passwordChangeDraft: { currentPassword: '', newPassword: '', confirmPassword: '' } }); return; }
  if (action === 'pw-modal-close') { setState({ showPasswordChange: false, passwordChangeError: '', passwordChangeBusy: false }); return; }
  if (action === 'show-register') { e.preventDefault(); S._showRegister = true; render(); return; }
  if (action === 'show-login') { e.preventDefault(); S._showRegister = false; render(); return; }

  // Board
  if (action === 'board-mode') { setState({ boardMode: btn.dataset.mode }); return; }
  if (action === 'toggle-show-all-filed') { setState({ boardShowAllFiled: !S.boardShowAllFiled }); return; }
  if (action === 'board-add-matter') {
    var clientList = Object.values(S.clients);
    if (clientList.length === 0) {
      setState({ currentView: 'clients' });
    } else {
      setState({ boardAddingMatter: true });
    }
    return;
  }
  if (action === 'board-cancel-add-matter') { setState({ boardAddingMatter: false }); return; }
  if (action === 'toggle-board-archived') { setState({ boardShowArchived: !S.boardShowArchived }); return; }
  if (action === 'archive-petition') {
    var pet = S.petitions[btn.dataset.id];
    if (!pet) return;
    var canArchive = S.role === 'admin' || pet.createdBy === S.currentUser;
    if (!canArchive) return;
    S.petitions[pet.id] = Object.assign({}, pet, { archived: true });
    S.log.push({ op: 'ARCHIVE', target: pet.id, payload: pet.caseNumber, frame: { t: now(), entity: 'petition' } });
    syncPetitionToMatrix(S.petitions[pet.id], 'archive');
    setState({});
    return;
  }
  if (action === 'open-filing') {
    setState({ selectedPetitionId: btn.dataset.id, editorTab: 'filing', currentView: 'editor' });
    return;
  }
  if (action === 'recover-petition') {
    var pet = S.petitions[btn.dataset.id];
    if (!pet) return;
    var canRecover = S.role === 'admin' || pet.createdBy === S.currentUser;
    if (!canRecover) return;
    var recovered = Object.assign({}, pet);
    delete recovered.archived;
    S.petitions[pet.id] = recovered;
    S.log.push({ op: 'RECOVER', target: pet.id, payload: pet.caseNumber, frame: { t: now(), entity: 'petition' } });
    syncPetitionToMatrix(S.petitions[pet.id], 'recover');
    setState({});
    return;
  }
  if (action === 'toggle-group') {
    var gKey = btn.dataset.group || (btn.closest('[data-group]') && btn.closest('[data-group]').dataset.group);
    if (gKey) { _collapsedGroups[gKey] = !_collapsedGroups[gKey]; render(); }
    return;
  }
  if (action === 'open-petition') {
    if (e.target.closest('.kb-card-actions')) return;
    if (_wasDragged) { _wasDragged = false; return; }
    setState({ selectedPetitionId: btn.dataset.id, currentView: 'editor' });
    return;
  }
  if (action === 'stage-change') {
    var pet = S.petitions[btn.dataset.id];
    if (!pet) return;
    if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;
    var idx = STAGES.indexOf(pet.stage);
    var ni = btn.dataset.dir === 'advance' ? idx + 1 : idx - 1;
    if (ni < 0 || ni >= STAGES.length) return;
    var next = STAGES[ni];
    // Stage gate: check requirements for advancing (not for reverting)
    if (ni > idx) {
      var client = S.clients[pet.clientId] || {};
      var gate = checkStageGate(pet, client, pet.stage, next);
      if (!gate.allowed) {
        toast('Missing: ' + gate.missing.join(', '), 'error');
        return;
      }
    }
    var t = now();
    S.log.push({ op: 'STAGE', target: btn.dataset.id, payload: next, frame: { t: t, prior: pet.stage } });
    S.petitions[pet.id] = Object.assign({}, pet, { stage: next, stageHistory: pet.stageHistory.concat([{ stage: next, at: t }]) });
    if (matrix.isReady() && pet.roomId) {
      var stageLabel = SM[next] ? SM[next].label : next;
      syncPetitionToMatrix(S.petitions[pet.id], 'stage \u2192 ' + stageLabel);
    }
    render();
    return;
  }

  // Clients
  if (action === 'select-client') { setState({ selectedClientId: btn.dataset.id }); return; }
  if (action === 'toggle-clients-archived') { setState({ clientsShowArchived: !S.clientsShowArchived }); return; }
  if (action === 'archive-client') {
    var id = btn.dataset.id;
    var cl = S.clients[id];
    if (!cl) return;
    var canArchive = S.role === 'admin' || Object.values(S.petitions).some(function(p) { return p.clientId === id && p.createdBy === S.currentUser; });
    if (!canArchive) return;
    cl.archived = true;
    S.log.push({ op: 'ARCHIVE', target: id, payload: cl.name, frame: { t: now(), entity: 'client' } });
    // Cascade: archive all petitions for this client
    Object.values(S.petitions).forEach(function(p) {
      if (p.clientId === id && !p.archived) {
        p.archived = true;
        S.log.push({ op: 'ARCHIVE', target: p.id, payload: p.caseNumber, frame: { t: now(), entity: 'petition', cascade: true } });
        syncPetitionToMatrix(p, 'archive');
      }
    });
    if (matrix.isReady() && cl.roomId) {
      var existing = matrix.getStateEvent(cl.roomId, EVT_CLIENT, '');
      var content = (existing && existing.content) ? Object.assign({}, existing.content, { archived: true }) : { id: cl.id, name: cl.name, country: cl.country, archived: true };
      matrix.sendStateEvent(cl.roomId, EVT_CLIENT, content, '')
        .then(function() { toast('Client archived', 'success'); })
        .catch(function(e) { console.error(e); toast('Archive client failed', 'error'); });
    }
    setState({ selectedClientId: null });
    return;
  }
  if (action === 'recover-client') {
    var id = btn.dataset.id;
    var cl = S.clients[id];
    if (!cl) return;
    var canRecover = S.role === 'admin' || Object.values(S.petitions).some(function(p) { return p.clientId === id && p.createdBy === S.currentUser; });
    if (!canRecover) return;
    delete cl.archived;
    S.log.push({ op: 'RECOVER', target: id, payload: cl.name, frame: { t: now(), entity: 'client' } });
    // Cascade: recover all petitions for this client
    Object.values(S.petitions).forEach(function(p) {
      if (p.clientId === id && p.archived) {
        delete p.archived;
        S.log.push({ op: 'RECOVER', target: p.id, payload: p.caseNumber, frame: { t: now(), entity: 'petition', cascade: true } });
        syncPetitionToMatrix(p, 'recover');
      }
    });
    if (matrix.isReady() && cl.roomId) {
      var existing = matrix.getStateEvent(cl.roomId, EVT_CLIENT, '');
      var content = (existing && existing.content) ? Object.assign({}, existing.content) : { id: cl.id, name: cl.name, country: cl.country };
      delete content.archived;
      matrix.sendStateEvent(cl.roomId, EVT_CLIENT, content, '')
        .then(function() { toast('Client recovered', 'success'); })
        .catch(function(e) { console.error(e); toast('Recover client failed', 'error'); });
    }
    setState({});
    return;
  }
  if (action === 'create-client') {
    var id = uid();
    S.clients[id] = { id: id, name: '', country: '', yearsInUS: '', entryDate: '', entryMethod: 'without inspection', apprehensionLocation: '', apprehensionDate: '', criminalHistory: 'has no criminal record', communityTies: '', createdAt: now(), roomId: '' };
    S.log.push({ op: 'CREATE', target: id, payload: null, frame: { t: now(), entity: 'client' } });
    setState({ selectedClientId: id });
    // Create a Matrix room for the client in the background
    createClientRoom(id).then(function(roomId) {
      if (roomId) toast('INS \u2295 client', 'success');
    });
    return;
  }
  if (action === 'create-petition') {
    var cid = btn.dataset.clientId;
    var pid = uid();
    var clientRoomId = (S.clients[cid] && S.clients[cid].roomId) || '';
    S.petitions[pid] = {
      id: pid, clientId: cid, createdBy: S.currentUser, stage: 'intake',
      stageHistory: [{ stage: 'intake', at: now() }],
      blocks: DEFAULT_BLOCKS.map(function(b) { return { id: b.id, type: b.type, content: b.content }; }),
      district: '', division: '', courtWebsite: '', caseNumber: '', facilityName: '', facilityCity: '',
      facilityState: '', warden: '', fieldOfficeDirector: '', fieldOfficeName: '',
      natIceDirector: '', natIceDirectorTitle: '', natDhsSecretary: '', natAttorneyGeneral: '',
      filingDate: '', filingDay: '', filingMonthYear: '',
      _bodyEdited: false, _exported: false,
      pageSettings: Object.assign({}, DEFAULT_PAGE_SETTINGS),
      createdAt: now(), roomId: clientRoomId,
    };
    S.log.push({ op: 'CREATE', target: pid, payload: null, frame: { t: now(), entity: 'petition', clientId: cid } });
    setState({ selectedPetitionId: pid, editorTab: 'court', currentView: 'editor' });
    // Sync petition to Matrix
    var pet = S.petitions[pid];
    if (pet.roomId && matrix.isReady()) {
      // Room already exists — sync immediately
      syncPetitionToMatrix(pet, 'petition');
      matrix.sendStateEvent(pet.roomId, EVT_PETITION_BLOCKS, { blocks: pet.blocks }, pet.id)
        .catch(function(e) { console.error('Block sync failed:', e); toast('ALT \u21CC block sync failed', 'error'); });
    } else if (_pendingRoomCreations[cid]) {
      // Room creation in flight — wait for it, then sync
      _pendingRoomCreations[cid].then(function(roomId) {
        if (roomId && S.petitions[pid]) {
          S.petitions[pid].roomId = roomId;
          syncPetitionToMatrix(S.petitions[pid], 'petition');
          matrix.sendStateEvent(roomId, EVT_PETITION_BLOCKS, { blocks: S.petitions[pid].blocks }, pid)
            .catch(function(e) { console.error('Block sync failed:', e); toast('ALT \u21CC block sync failed', 'error'); });
        }
      });
    }
    return;
  }

  // Export
  if (action === 'export-word' || action === 'export-pdf') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    // Track that document has been exported for filing readiness
    if (!pet._exported) {
      pet._exported = true;
      S.petitions[pet.id] = Object.assign({}, pet);
      if (pet.roomId && matrix.isReady()) {
        syncPetitionToMatrix(S.petitions[pet.id], 'petition');
      }
    }
    var cl = S.clients[pet.clientId] || {};
    var a1 = pet._att1Id ? S.attProfiles[pet._att1Id] : null;
    var a2 = pet._att2Id ? S.attProfiles[pet._att2Id] : null;
    var vars = buildVarMap(cl, pet, a1 || {}, a2 || {}, S.national);
    if (action === 'export-word') {
      // Use proper .docx generation if library loaded, else fall back to HTML .doc
      if (typeof docx !== 'undefined' && docx.Packer) {
        doExportDocx(pet.blocks, vars, cl.name);
      } else {
        buildExportFromTemplate(vars, true, pet.pageSettings)
          .then(function(html) {
            var blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'habeas-' + (cl.name || 'matter').replace(/\s+/g, '-').toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.doc';
            document.body.appendChild(a);
            a.click();
            setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
          })
          .catch(function(err) {
            console.error('Template export failed, falling back to block export:', err);
            doExportDoc(pet.blocks, vars, cl.name, pet.pageSettings);
          });
      }
    } else {
      // PDF: template-based print flow with DOM-based pagination
      buildExportFromTemplate(vars, false, pet.pageSettings)
        .then(function(html) {
          var w = window.open('', '_blank', 'width=850,height=1100');
          if (!w) { alert('Allow popups for PDF export'); return; }
          w.document.write(html);
          w.document.close();
          setTimeout(function() {
            paginatePrintWindow(w);
            setTimeout(function() { w.focus(); w.print(); }, 300);
          }, 500);
        })
        .catch(function(err) {
          console.error('Template export failed, falling back to block export:', err);
          doExportPDF(pet.blocks, vars, pet.pageSettings);
        });
    }
    return;
  }

  // CSV exports
  if (action === 'export-petitions-csv') { exportPetitionsCSV(); return; }
  if (action === 'export-clients-csv') { exportClientsCSV(); return; }
  if (action === 'export-facilities-csv') { if (S.role === 'admin') exportFacilitiesCSV(); return; }
  if (action === 'export-courts-csv') { if (S.role === 'admin') exportCourtsCSV(); return; }
  if (action === 'export-attorneys-csv') { if (S.role === 'admin') exportAttorneyProfilesCSV(); return; }

  // Directory
  if (action === 'dir-tab') { setState({ dirTab: btn.dataset.tab, editId: null, draft: {} }); return; }
  if (action === 'toggle-dir-archived') { setState({ dirShowArchived: !S.dirShowArchived }); return; }
  if (action === 'cancel-edit') { setState({ editId: null, draft: {} }); return; }
  if (action === 'edit-record') {
    if (S.role !== 'admin') return;
    var type = btn.dataset.type;
    var id = btn.dataset.id;
    var record = type === 'facility' ? S.facilities[id] : type === 'court' ? S.courts[id] : S.attProfiles[id];
    if (record) setState({ editId: id, draft: Object.assign({}, record) });
    return;
  }
  if (action === 'add-facility') {
    if (S.role !== 'admin') return;
    var id = uid();
    var f = { id: id, name: '', city: '', state: '', warden: '', fieldOfficeName: '', fieldOfficeDirector: '', createdBy: S.currentUser, createdAt: now(), updatedBy: S.currentUser, updatedAt: now() };
    S.facilities[id] = f;
    S.log.push({ op: 'CREATE', target: id, payload: null, frame: { t: now(), entity: 'facility' } });
    setState({ editId: id, draft: Object.assign({}, f) });
    return;
  }
  if (action === 'save-facility') {
    if (S.role !== 'admin') return;
    var oldF = S.facilities[S.draft.id];
    var f = Object.assign({}, S.draft, { updatedBy: S.currentUser, updatedAt: now() });
    if (oldF && f.warden !== oldF.warden) {
      f.wardenUpdatedBy = S.currentUser;
      f.wardenUpdatedAt = now();
    }
    S.facilities[f.id] = f;
    S.log.push({ op: 'UPDATE', target: f.id, payload: f.name, frame: { t: now(), entity: 'facility' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_FACILITY, { name: f.name, city: f.city, state: f.state, warden: f.warden, fieldOfficeName: f.fieldOfficeName, fieldOfficeDirector: f.fieldOfficeDirector, wardenUpdatedBy: f.wardenUpdatedBy, wardenUpdatedAt: f.wardenUpdatedAt }, f.id)
        .then(function() { toast('ALT \u21CC facility', 'success'); })
        .catch(function(e) { console.error(e); toast('ALT \u21CC facility failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'update-warden') {
    var id = btn.dataset.id;
    var f = S.facilities[id];
    if (!f) return;
    var input = document.querySelector('[data-warden-input="' + id + '"]');
    if (!input) return;
    var newWarden = input.value.trim();
    f.warden = newWarden;
    f.wardenUpdatedBy = S.currentUser;
    f.wardenUpdatedAt = now();
    S.log.push({ op: 'UPDATE', target: 'facility.' + id + '.warden', payload: newWarden, frame: { t: now(), entity: 'facility' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_FACILITY, { name: f.name, city: f.city, state: f.state, warden: f.warden, fieldOfficeName: f.fieldOfficeName, fieldOfficeDirector: f.fieldOfficeDirector, wardenUpdatedBy: f.wardenUpdatedBy, wardenUpdatedAt: f.wardenUpdatedAt }, f.id)
        .then(function() { toast('Warden updated', 'success'); })
        .catch(function(e) { console.error(e); toast('Warden update failed', 'error'); });
    }
    render();
    return;
  }
  if (action === 'archive-facility') {
    if (S.role !== 'admin') return;
    var id = btn.dataset.id;
    var f = S.facilities[id];
    if (!f) return;
    f.archived = true;
    S.log.push({ op: 'ARCHIVE', target: id, payload: f.name, frame: { t: now(), entity: 'facility' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_FACILITY, { name: f.name, city: f.city, state: f.state, warden: f.warden, fieldOfficeName: f.fieldOfficeName, fieldOfficeDirector: f.fieldOfficeDirector, archived: true }, id)
        .then(function() { toast('Facility archived', 'success'); })
        .catch(function(e) { console.error(e); toast('Archive facility failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'recover-facility') {
    if (S.role !== 'admin') return;
    var id = btn.dataset.id;
    var f = S.facilities[id];
    if (!f) return;
    delete f.archived;
    S.log.push({ op: 'RECOVER', target: id, payload: f.name, frame: { t: now(), entity: 'facility' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_FACILITY, { name: f.name, city: f.city, state: f.state, warden: f.warden, fieldOfficeName: f.fieldOfficeName, fieldOfficeDirector: f.fieldOfficeDirector }, id)
        .then(function() { toast('Facility recovered', 'success'); })
        .catch(function(e) { console.error(e); toast('Recover facility failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'add-court') {
    if (S.role !== 'admin') return;
    var id = uid();
    var c = { id: id, district: '', division: '', circuit: '', ecfUrl: '', pacerUrl: '', createdBy: S.currentUser, createdAt: now(), updatedBy: S.currentUser, updatedAt: now() };
    S.courts[id] = c;
    S.log.push({ op: 'CREATE', target: id, payload: null, frame: { t: now(), entity: 'court' } });
    setState({ editId: id, draft: Object.assign({}, c) });
    return;
  }
  if (action === 'save-court') {
    if (S.role !== 'admin') return;
    var c = Object.assign({}, S.draft, { updatedBy: S.currentUser, updatedAt: now() });
    S.courts[c.id] = c;
    S.log.push({ op: 'UPDATE', target: c.id, payload: c.district, frame: { t: now(), entity: 'court' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_COURT, { district: c.district, division: c.division, circuit: c.circuit || '', ecfUrl: c.ecfUrl || '', pacerUrl: c.pacerUrl || '' }, c.id)
        .then(function() { toast('ALT \u21CC court', 'success'); })
        .catch(function(e) { console.error(e); toast('ALT \u21CC court failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'archive-court') {
    if (S.role !== 'admin') return;
    var id = btn.dataset.id;
    var c = S.courts[id];
    if (!c) return;
    c.archived = true;
    S.log.push({ op: 'ARCHIVE', target: id, payload: c.district, frame: { t: now(), entity: 'court' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_COURT, { district: c.district, division: c.division, archived: true }, id)
        .then(function() { toast('Court archived', 'success'); })
        .catch(function(e) { console.error(e); toast('Archive court failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'recover-court') {
    if (S.role !== 'admin') return;
    var id = btn.dataset.id;
    var c = S.courts[id];
    if (!c) return;
    delete c.archived;
    S.log.push({ op: 'RECOVER', target: id, payload: c.district, frame: { t: now(), entity: 'court' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_COURT, { district: c.district, division: c.division }, id)
        .then(function() { toast('Court recovered', 'success'); })
        .catch(function(e) { console.error(e); toast('Recover court failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'add-attorney') {
    if (S.role !== 'admin') return;
    var id = uid();
    var a = { id: id, name: '', barNo: '', firm: '', address: '', cityStateZip: '', phone: '', fax: '', email: '', proHacVice: '', createdBy: S.currentUser, createdAt: now(), updatedBy: S.currentUser, updatedAt: now() };
    S.attProfiles[id] = a;
    S.log.push({ op: 'CREATE', target: id, payload: null, frame: { t: now(), entity: 'attorney_profile' } });
    setState({ editId: id, draft: Object.assign({}, a) });
    return;
  }
  if (action === 'save-attorney') {
    if (S.role !== 'admin') return;
    var a = Object.assign({}, S.draft, { updatedBy: S.currentUser, updatedAt: now() });
    S.attProfiles[a.id] = a;
    S.log.push({ op: 'UPDATE', target: a.id, payload: a.name, frame: { t: now(), entity: 'attorney_profile' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_ATTORNEY, { name: a.name, barNo: a.barNo, firm: a.firm, address: a.address, cityStateZip: a.cityStateZip, phone: a.phone, fax: a.fax, email: a.email, proHacVice: a.proHacVice }, a.id)
        .then(function() { toast('ALT \u21CC attorney', 'success'); })
        .catch(function(e) { console.error(e); toast('ALT \u21CC attorney failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'archive-attorney') {
    if (S.role !== 'admin') return;
    var id = btn.dataset.id;
    var a = S.attProfiles[id];
    if (!a) return;
    a.archived = true;
    S.log.push({ op: 'ARCHIVE', target: id, payload: a.name, frame: { t: now(), entity: 'attorney_profile' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_ATTORNEY, { name: a.name, barNo: a.barNo, firm: a.firm, address: a.address, cityStateZip: a.cityStateZip, phone: a.phone, fax: a.fax, email: a.email, proHacVice: a.proHacVice, archived: true }, a.id)
        .then(function() { toast('Attorney archived', 'success'); })
        .catch(function(e) { console.error(e); toast('Archive attorney failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }
  if (action === 'recover-attorney') {
    if (S.role !== 'admin') return;
    var id = btn.dataset.id;
    var a = S.attProfiles[id];
    if (!a) return;
    delete a.archived;
    S.log.push({ op: 'RECOVER', target: id, payload: a.name, frame: { t: now(), entity: 'attorney_profile' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_ATTORNEY, { name: a.name, barNo: a.barNo, firm: a.firm, address: a.address, cityStateZip: a.cityStateZip, phone: a.phone, fax: a.fax, email: a.email, proHacVice: a.proHacVice }, a.id)
        .then(function() { toast('Attorney recovered', 'success'); })
        .catch(function(e) { console.error(e); toast('Recover attorney failed', 'error'); });
    }
    setState({ editId: null, draft: {} });
    return;
  }

  // Admin tab switching
  if (action === 'admin-switch-tab') {
    var tab = btn.dataset.tab;
    setState({ adminTab: tab });
    if (tab === 'deploy' && S.deployTokenSet && !S.deployHistoryLoaded) {
      loadDeployHistory();
    }
    return;
  }

  // Deployment panel actions
  if (action === 'deploy-save-token') {
    var tokenInput = document.querySelector('[data-change="deploy-gh-token"]');
    var token = tokenInput ? tokenInput.value.trim() : '';
    if (!token) { toast('Please enter a GitHub token', 'error'); return; }
    sessionStorage.setItem('amino_gh_token', token);
    setState({ deployGithubToken: token, deployTokenSet: true, deployHistoryLoaded: false });
    // Persist PAT to Matrix org room so it survives across sessions
    if (matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_GITHUB, { pat: token }, '')
        .then(function() { toast('GitHub token saved', 'success'); })
        .catch(function(e) {
          console.warn('[amino] Failed to persist GitHub PAT to Matrix:', e);
          toast('GitHub token saved for this session (failed to persist to server)', 'warn');
        });
    } else {
      toast('GitHub token saved for this session', 'success');
    }
    loadDeployHistory();
    return;
  }
  if (action === 'deploy-clear-token') {
    sessionStorage.removeItem('amino_gh_token');
    setState({ deployGithubToken: '', deployTokenSet: false, deployHistory: [], deployHistoryLoaded: false });
    // Clear PAT from Matrix org room as well
    if (matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_GITHUB, {}, '')
        .then(function() { toast('GitHub token cleared', 'info'); })
        .catch(function(e) {
          console.warn('[amino] Failed to clear GitHub PAT from Matrix:', e);
          toast('GitHub token cleared locally', 'info');
        });
    } else {
      toast('GitHub token cleared', 'info');
    }
    return;
  }
  if (action === 'deploy-refresh-history') {
    resetDeployReview();
    loadDeployHistory();
    return;
  }
  if (action === 'deploy-start-review') {
    loadDeployDiff();
    return;
  }
  if (action === 'deploy-cancel-review') {
    resetDeployReview();
    return;
  }
  if (action === 'deploy-to-production') {
    if (S.deployDeployBusy) return;
    // Enforce review gate — must be approved before deploying
    if (S.deployReviewState !== 'approved') {
      toast('You must review and approve changes before deploying.', 'error');
      return;
    }
    var pendingCount = 0;
    var foundCurr = false;
    S.deployHistory.forEach(function(e) { if (e.isCurrent) foundCurr = true; if (!foundCurr && !e.isCurrent) pendingCount++; });
    if (!foundCurr) pendingCount = S.deployHistory.length;
    if (!confirm('Deploy latest main to production?\n\n' + pendingCount + ' pending change(s) will go live for all users.\n\nContinue?')) return;
    triggerProductionDeploy('');
    // Reset review state after triggering deploy
    resetDeployReview();
    return;
  }
  if (action === 'deploy-specific') {
    if (S.deployDeployBusy) return;
    var sha = btn.dataset.sha;
    var msg = btn.dataset.msg;
    if (!confirm('Deploy version ' + sha.substring(0, 7) + ' to production?\n\nThis is a direct deploy from version history and will replace the current live version.\n\n' + msg)) return;
    triggerProductionDeploy(sha);
    return;
  }
  if (action === 'deploy-rollback') {
    if (S.deployRollbackBusy) return;
    var sha = btn.dataset.sha;
    var msg = btn.dataset.msg;
    if (!confirm('Rollback to version ' + sha.substring(0, 7) + '?\n\n' + msg + '\n\nThis will replace the current live version.')) return;
    triggerRollback(sha, 'Rollback to ' + sha.substring(0, 7) + ': ' + msg);
    return;
  }

  // Admin view actions
  if (action === 'admin-show-create') {
    if (S.role !== 'admin') return;
    setState({ adminEditUserId: 'new', adminDraft: { username: '', displayName: '', password: '', email: '', role: 'attorney' } });
    return;
  }
  if (action === 'admin-refresh-users') {
    if (S.role !== 'admin') return;
    setState({ serverUsersLoaded: false, serverUsersError: '' });
    matrix.listUsers()
      .then(function(serverUsers) {
        setState({ users: mergeServerUsers(serverUsers), serverUsersLoaded: true, serverUsersError: '' });
      })
      .catch(function(err) {
        var msg = (err && err.status === 403)
          ? 'Cannot list server users: lacks Synapse admin privileges.'
          : 'Could not fetch server users: ' + ((err && err.error) || 'unknown error');
        setState({ serverUsersLoaded: true, serverUsersError: msg });
      });
    return;
  }
  if (action === 'admin-cancel-create' || action === 'admin-cancel-edit') {
    setState({ adminEditUserId: null, adminDraft: {} });
    return;
  }
  if (action === 'admin-generate-password') {
    if (S.role !== 'admin') return;
    var pw = generateSecurePassword(16);
    S.adminDraft.password = pw;
    S.adminDraft.passwordVisible = true;
    setState({});
    return;
  }
  if (action === 'admin-edit-user') {
    if (S.role !== 'admin') return;
    var mxid = btn.dataset.mxid;
    var user = S.users[mxid];
    if (user) {
      setState({ adminEditUserId: mxid, adminDraft: { displayName: user.displayName, email: user.email || '', role: user.role || 'attorney', password: '' } });
    }
    return;
  }
  if (action === 'admin-create-user') {
    if (S.role !== 'admin') return;
    handleAdminCreateUser();
    return;
  }
  if (action === 'admin-save-user') {
    if (S.role !== 'admin') return;
    handleAdminSaveUser();
    return;
  }
  if (action === 'admin-adopt-user') {
    if (S.role !== 'admin') return;
    var mxid = btn.dataset.mxid;
    if (mxid) handleAdminAdoptUser(mxid);
    return;
  }
  if (action === 'admin-deactivate-user') {
    if (S.role !== 'admin') return;
    var mxid = btn.dataset.mxid;
    if (mxid && confirm('Deactivate user ' + mxid + '? This cannot be undone.')) {
      handleAdminDeactivateUser(mxid);
    }
    return;
  }
  if (action === 'admin-resend-credentials') {
    if (S.role !== 'admin') return;
    var mxid = btn.dataset.mxid;
    var user = S.users[mxid];
    if (user && user.email) {
      var username = mxid.replace(/@(.+):.*/, '$1');
      sendCredentialEmail(user.email, user.displayName, username, null);
      toast('Opening email client to send credentials to ' + user.email, 'info');
    } else {
      toast('No email address on file for this user. Edit the user to add one.', 'error');
    }
    return;
  }
  if (action === 'admin-send-credentials') {
    if (S.role !== 'admin') return;
    var pending = S._pendingCredentialEmail;
    if (pending) {
      sendCredentialEmail(pending.email, pending.displayName, pending.username, pending.password);
      S._pendingCredentialEmail = null;
      toast('Opening email client to send credentials', 'info');
      render();
    }
    return;
  }
  if (action === 'admin-dismiss-credential-banner') {
    S._pendingCredentialEmail = null;
    render();
    return;
  }

  // Mark as Filed action
  if (action === 'mark-as-filed') {
    var pet = S.petitions[btn.dataset.id];
    if (!pet) return;
    if (!pet.caseNumber || !pet.caseNumber.trim() || !pet._exported) {
      toast('Enter case number and export document first', 'error');
      return;
    }
    var t = now();
    S.log.push({ op: 'STAGE', target: pet.id, payload: 'filed', frame: { t: t, prior: pet.stage } });
    S.petitions[pet.id] = Object.assign({}, pet, { stage: 'filed', stageHistory: pet.stageHistory.concat([{ stage: 'filed', at: t }]) });
    if (matrix.isReady() && pet.roomId) {
      syncPetitionToMatrix(S.petitions[pet.id], 'stage \u2192 Filed');
    }
    toast('Matter marked as filed', 'success');
    render();
    return;
  }

  // Editor tabs
  if (action === 'ed-tab') { cleanupInlineAdd(); setState({ editorTab: btn.dataset.tab, inlineAdd: null, draft: {} }); return; }
  if (action === 'goto-directory') { setState({ currentView: 'directory', inlineAdd: null, draft: {} }); return; }

  // ── Inline Add-to-Directory from Editor ───────────────────────
  if (action === 'inline-add-court') {
    cleanupInlineAdd();
    var id = uid();
    var c = { id: id, district: '', division: '', circuit: '', ecfUrl: '', pacerUrl: '', createdBy: S.currentUser, createdAt: now(), updatedBy: S.currentUser, updatedAt: now() };
    setState({ inlineAdd: { type: 'court', id: id }, draft: Object.assign({}, c) });
    return;
  }
  if (action === 'inline-add-facility') {
    cleanupInlineAdd();
    var id = uid();
    var f = { id: id, name: '', city: '', state: '', warden: '', fieldOfficeName: '', fieldOfficeDirector: '', createdBy: S.currentUser, createdAt: now(), updatedBy: S.currentUser, updatedAt: now() };
    setState({ inlineAdd: { type: 'facility', id: id }, draft: Object.assign({}, f) });
    return;
  }
  if (action === 'inline-add-att1') {
    cleanupInlineAdd();
    var id = uid();
    var a = { id: id, name: '', barNo: '', firm: '', address: '', cityStateZip: '', phone: '', fax: '', email: '', proHacVice: '', createdBy: S.currentUser, createdAt: now(), updatedBy: S.currentUser, updatedAt: now() };
    setState({ inlineAdd: { type: 'att1', id: id }, draft: Object.assign({}, a) });
    return;
  }
  if (action === 'inline-add-att2') {
    cleanupInlineAdd();
    var id = uid();
    var a = { id: id, name: '', barNo: '', firm: '', address: '', cityStateZip: '', phone: '', fax: '', email: '', proHacVice: '', createdBy: S.currentUser, createdAt: now(), updatedBy: S.currentUser, updatedAt: now() };
    setState({ inlineAdd: { type: 'att2', id: id }, draft: Object.assign({}, a) });
    return;
  }
  if (action === 'inline-cancel') {
    cleanupInlineAdd();
    setState({ inlineAdd: null, draft: {} });
    return;
  }
  if (action === 'inline-save-court') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!S.inlineAdd || !S.draft.id) return;
    var c = Object.assign({}, S.draft, { updatedBy: S.currentUser, updatedAt: now() });
    S.courts[c.id] = c;
    S.log.push({ op: 'CREATE', target: c.id, payload: c.district, frame: { t: now(), entity: 'court' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_COURT, { district: c.district, division: c.division, circuit: c.circuit || '', ecfUrl: c.ecfUrl || '', pacerUrl: c.pacerUrl || '' }, c.id)
        .then(function() { toast('Court added', 'success'); })
        .catch(function(e) { console.error(e); toast('Court save failed', 'error'); });
    }
    if (pet) {
      Object.assign(pet, { district: c.district, division: c.division, courtWebsite: c.ecfUrl || c.website || '', _courtId: c.id });
      S.log.push({ op: 'APPLY', target: 'court', payload: c.id, frame: { t: now(), petition: pet.id } });
      syncPetitionToMatrix(pet, 'Court');
    }
    setState({ inlineAdd: null, draft: {} });
    return;
  }
  if (action === 'inline-save-facility') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!S.inlineAdd || !S.draft.id) return;
    var f = Object.assign({}, S.draft, { updatedBy: S.currentUser, updatedAt: now() });
    S.facilities[f.id] = f;
    S.log.push({ op: 'CREATE', target: f.id, payload: f.name, frame: { t: now(), entity: 'facility' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_FACILITY, { name: f.name, city: f.city, state: f.state, warden: f.warden, fieldOfficeName: f.fieldOfficeName, fieldOfficeDirector: f.fieldOfficeDirector }, f.id)
        .then(function() { toast('Facility added', 'success'); })
        .catch(function(e) { console.error(e); toast('Facility save failed', 'error'); });
    }
    if (pet) {
      Object.assign(pet, { facilityName: f.name, facilityCity: f.city, facilityState: f.state, warden: f.warden, fieldOfficeName: f.fieldOfficeName, fieldOfficeDirector: f.fieldOfficeDirector, _facilityId: f.id });
      S.log.push({ op: 'APPLY', target: 'facility', payload: f.id, frame: { t: now(), petition: pet.id } });
      syncPetitionToMatrix(pet, 'Facility');
    }
    setState({ inlineAdd: null, draft: {} });
    return;
  }
  if (action === 'inline-save-att1') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!S.inlineAdd || !S.draft.id) return;
    var a = Object.assign({}, S.draft, { updatedBy: S.currentUser, updatedAt: now() });
    S.attProfiles[a.id] = a;
    S.log.push({ op: 'CREATE', target: a.id, payload: a.name, frame: { t: now(), entity: 'attorney_profile' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_ATTORNEY, { name: a.name, barNo: a.barNo, firm: a.firm, address: a.address, cityStateZip: a.cityStateZip, phone: a.phone, fax: a.fax, email: a.email, proHacVice: a.proHacVice }, a.id)
        .then(function() { toast('Attorney added', 'success'); })
        .catch(function(e) { console.error(e); toast('Attorney save failed', 'error'); });
    }
    if (pet) {
      pet._att1Id = a.id;
      S.log.push({ op: 'APPLY', target: 'att1', payload: a.id, frame: { t: now(), petition: pet.id } });
      syncPetitionToMatrix(pet, 'Attorney 1');
    }
    setState({ inlineAdd: null, draft: {} });
    return;
  }
  if (action === 'inline-save-att2') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!S.inlineAdd || !S.draft.id) return;
    var a = Object.assign({}, S.draft, { updatedBy: S.currentUser, updatedAt: now() });
    S.attProfiles[a.id] = a;
    S.log.push({ op: 'CREATE', target: a.id, payload: a.name, frame: { t: now(), entity: 'attorney_profile' } });
    if (matrix.isReady() && matrix.orgRoomId) {
      matrix.sendStateEvent(matrix.orgRoomId, EVT_ATTORNEY, { name: a.name, barNo: a.barNo, firm: a.firm, address: a.address, cityStateZip: a.cityStateZip, phone: a.phone, fax: a.fax, email: a.email, proHacVice: a.proHacVice }, a.id)
        .then(function() { toast('Attorney added', 'success'); })
        .catch(function(e) { console.error(e); toast('Attorney save failed', 'error'); });
    }
    if (pet) {
      pet._att2Id = a.id;
      S.log.push({ op: 'APPLY', target: 'att2', payload: a.id, frame: { t: now(), petition: pet.id } });
      syncPetitionToMatrix(pet, 'Attorney 2');
    }
    setState({ inlineAdd: null, draft: {} });
    return;
  }
});

// ── Input/Change Event Handling ──────────────────────────────────
function dispatchFieldChange(action, key, val) {
  if (action === 'draft-field') {
    S.draft[key] = val;
    return;
  }

  if (action === 'admin-draft-field') {
    S.adminDraft[key] = val;
    return;
  }

  if (action === 'national-field') {
    if (S.role !== 'admin') return;
    S.national[key] = val;
    S.national.updatedBy = S.currentUser;
    S.national.updatedAt = now();
    S.log.push({ op: 'UPDATE', target: 'national', payload: val, frame: { t: now(), field: key } });
    if (matrix.isReady() && matrix.orgRoomId) {
      debouncedSync('national', function() {
        var full = { iceDirector: S.national.iceDirector, iceDirectorTitle: S.national.iceDirectorTitle, dhsSecretary: S.national.dhsSecretary, attorneyGeneral: S.national.attorneyGeneral };
        matrix.sendStateEvent(matrix.orgRoomId, EVT_NATIONAL, full, '').catch(function(e) { console.error(e); toast('ALT \u21CC national defaults sync failed', 'error'); });
      });
    }
    refreshVariableSpans();
    return;
  }
  if (action === 'client-field') {
    var client = S.selectedClientId ? S.clients[S.selectedClientId] : null;
    if (!client) return;
    if (S.role !== 'admin') {
      var hasOwnership = Object.values(S.petitions).some(function(p) {
        return p.clientId === client.id && p.createdBy === S.currentUser;
      });
      if (!hasOwnership) return;
    }
    client[key] = val;
    S.log.push({ op: 'FILL', target: 'client.' + key, payload: val, frame: { t: now(), entity: 'client', id: client.id } });
    debouncedSync('client-' + client.id, function() {
      if (client.roomId) {
        syncClientToMatrix(client, 'client');
      } else if (_pendingRoomCreations[client.id]) {
        _pendingRoomCreations[client.id].then(function(roomId) {
          if (roomId) syncClientToMatrix(client, 'client');
        });
      } else if (matrix.isReady()) {
        createClientRoom(client.id);
      }
    });
    refreshVariableSpans();
    return;
  }
  if (action === 'editor-client-field') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;
    var client = S.clients[pet.clientId];
    if (!client) return;
    client[key] = val;
    S.log.push({ op: 'FILL', target: 'client.' + key, payload: val, frame: { t: now(), entity: 'client', id: client.id } });
    debouncedSync('client-' + client.id, function() {
      if (client.roomId) {
        syncClientToMatrix(client, 'client');
      } else if (_pendingRoomCreations[client.id]) {
        _pendingRoomCreations[client.id].then(function(roomId) {
          if (roomId) syncClientToMatrix(client, 'client');
        });
      } else if (matrix.isReady()) {
        createClientRoom(client.id);
      }
    });
    refreshVariableSpans();
    return;
  }
  if (action === 'editor-pet-field') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;
    pet[key] = val;
    S.log.push({ op: 'FILL', target: 'petition.' + key, payload: val, frame: { t: now(), entity: 'petition', id: pet.id } });
    debouncedSync('petition-' + pet.id, function() { syncPetitionToMatrix(pet, 'petition'); });
    refreshVariableSpans();
    return;
  }
  if (action === 'filing-case-number') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    pet.caseNumber = val;
    S.log.push({ op: 'FILL', target: 'petition.caseNumber', payload: val, frame: { t: now(), entity: 'petition', id: pet.id } });
    debouncedSync('petition-' + pet.id, function() { syncPetitionToMatrix(pet, 'petition'); });
    refreshVariableSpans();
    // Re-render filing panel to update Mark as Filed button state
    render();
    return;
  }
  if (action === 'page-settings') {
    var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
    if (!pet) return;
    if (!pet.pageSettings) pet.pageSettings = Object.assign({}, DEFAULT_PAGE_SETTINGS);
    if (key === 'showHeaderOnFirstPage' || key === 'showFooterOnFirstPage') {
      pet.pageSettings[key] = (val === 'true');
    } else {
      pet.pageSettings[key] = val;
    }
    S.log.push({ op: 'FILL', target: 'petition.pageSettings.' + key, payload: val, frame: { t: now(), entity: 'petition', id: pet.id } });
    debouncedSync('petition-' + pet.id, function() { syncPetitionToMatrix(pet); });
    setState({});
    return;
  }
}

document.addEventListener('input', function(e) {
  var el = e.target;
  if (!el.dataset || !el.dataset.change) return;
  var action = el.dataset.change;
  var key = el.dataset.fieldKey;
  var val = el.value;
  if (action.match(/-custom$/)) {
    action = action.replace(/-custom$/, '');
  }
  // For text fields with blur-save actions, only update local state on input;
  // the full save (log + sync) happens on the 'change' event (fires on blur).
  if (BLUR_SAVE_ACTIONS[action]) {
    updateFieldLocally(action, key, val);
    return;
  }
  dispatchFieldChange(action, key, val);
});

document.addEventListener('change', function(e) {
  var el = e.target;
  if (!el.dataset || !el.dataset.change) return;
  var action = el.dataset.change;
  var val = el.value;

  // Enum-or-custom dropdown changed
  if (action.match(/-enum$/)) {
    var baseAction = action.replace(/-enum$/, '');
    var key = el.dataset.fieldKey;
    if (val === '__custom__') {
      var customInp = el.parentNode.querySelector('.enum-custom-inp');
      if (customInp) { customInp.style.display = ''; customInp.focus(); }
      return;
    } else {
      var customInp = el.parentNode.querySelector('.enum-custom-inp');
      if (customInp) customInp.style.display = 'none';
      dispatchFieldChange(baseAction, key, val);
      return;
    }
  }

  // Pure enum selects (type: 'enum') and date pickers fire 'change'
  if (el.tagName === 'SELECT' && el.dataset.fieldKey && !action.match(/^apply-/)) {
    dispatchFieldChange(action, el.dataset.fieldKey, val);
    return;
  }

  // Text inputs with blur-save actions: full save on blur (change fires when field loses focus)
  var blurAction = action.match(/-custom$/) ? action.replace(/-custom$/, '') : action;
  if (el.dataset.fieldKey && BLUR_SAVE_ACTIONS[blurAction]) {
    dispatchFieldChange(blurAction, el.dataset.fieldKey, val);
    return;
  }

  if (action === 'admin-draft-role') {
    S.adminDraft.role = val;
    return;
  }

  // Deploy review checkbox
  if (action === 'deploy-approve-checkbox') {
    if (el.checked) {
      approveDeployReview();
    } else {
      setState({ deployReviewState: 'reviewing' });
    }
    return;
  }

  if (action === 'board-table-group') {
    setState({ boardTableGroup: val });
    return;
  }

  if (action === 'board-create-matter') {
    var cid = val;
    if (!cid) return;
    var pid = uid();
    var clientRoomId = (S.clients[cid] && S.clients[cid].roomId) || '';
    S.petitions[pid] = {
      id: pid, clientId: cid, createdBy: S.currentUser, stage: 'intake',
      stageHistory: [{ stage: 'intake', at: now() }],
      blocks: DEFAULT_BLOCKS.map(function(b) { return { id: b.id, type: b.type, content: b.content }; }),
      district: '', division: '', courtWebsite: '', caseNumber: '', facilityName: '', facilityCity: '',
      facilityState: '', warden: '', fieldOfficeDirector: '', fieldOfficeName: '',
      natIceDirector: '', natIceDirectorTitle: '', natDhsSecretary: '', natAttorneyGeneral: '',
      filingDate: '', filingDay: '', filingMonthYear: '',
      _bodyEdited: false, _exported: false,
      pageSettings: Object.assign({}, DEFAULT_PAGE_SETTINGS),
      createdAt: now(), roomId: clientRoomId,
    };
    S.log.push({ op: 'CREATE', target: pid, payload: null, frame: { t: now(), entity: 'petition', clientId: cid } });
    setState({ selectedPetitionId: pid, editorTab: 'court', currentView: 'editor', boardAddingMatter: false });
    var newPet = S.petitions[pid];
    if (newPet.roomId && matrix.isReady()) {
      syncPetitionToMatrix(newPet, 'petition');
      matrix.sendStateEvent(newPet.roomId, EVT_PETITION_BLOCKS, { blocks: newPet.blocks }, newPet.id)
        .catch(function(e) { console.error('Block sync failed:', e); toast('ALT \u21CC block sync failed', 'error'); });
    } else if (_pendingRoomCreations[cid]) {
      _pendingRoomCreations[cid].then(function(roomId) {
        if (roomId && S.petitions[pid]) {
          S.petitions[pid].roomId = roomId;
          syncPetitionToMatrix(S.petitions[pid], 'petition');
          matrix.sendStateEvent(roomId, EVT_PETITION_BLOCKS, { blocks: S.petitions[pid].blocks }, pid)
            .catch(function(e) { console.error('Block sync failed:', e); toast('ALT \u21CC block sync failed', 'error'); });
        }
      });
    }
    return;
  }

  var pet = S.selectedPetitionId ? S.petitions[S.selectedPetitionId] : null;
  if (!pet) return;
  if (S.role !== 'admin' && pet.createdBy !== S.currentUser) return;

  if (action === 'apply-court') {
    var c = S.courts[val];
    if (c) {
      Object.assign(pet, { district: c.district, division: c.division, courtWebsite: c.ecfUrl || c.website || '', _courtId: val });
      S.log.push({ op: 'APPLY', target: 'court', payload: val, frame: { t: now(), petition: pet.id } });
      syncPetitionToMatrix(pet, 'Court');
      render();
    }
    return;
  }
  if (action === 'apply-facility') {
    var f = S.facilities[val];
    if (f) {
      Object.assign(pet, { facilityName: f.name, facilityCity: f.city, facilityState: f.state, warden: f.warden, fieldOfficeName: f.fieldOfficeName, fieldOfficeDirector: f.fieldOfficeDirector, _facilityId: val });
      S.log.push({ op: 'APPLY', target: 'facility', payload: val, frame: { t: now(), petition: pet.id } });
      syncPetitionToMatrix(pet, 'Facility');
      render();
    }
    return;
  }
  if (action === 'apply-att1') {
    pet._att1Id = val;
    S.log.push({ op: 'APPLY', target: 'att1', payload: val, frame: { t: now(), petition: pet.id } });
    syncPetitionToMatrix(pet, 'Attorney 1');
    render();
    return;
  }
  if (action === 'apply-att2') {
    pet._att2Id = val;
    S.log.push({ op: 'APPLY', target: 'att2', payload: val, frame: { t: now(), petition: pet.id } });
    syncPetitionToMatrix(pet, 'Attorney 2');
    render();
    return;
  }
});

// ── Admin Business Logic ─────────────────────────────────────────

// ── Password Change Handlers ─────────────────────────────────────
function handlePasswordChange() {
  var currentEl = document.getElementById('pw-current');
  var newEl = document.getElementById('pw-new');
  var confirmEl = document.getElementById('pw-confirm');
  if (!currentEl || !newEl || !confirmEl) return;

  var currentPw = currentEl.value;
  var newPw = newEl.value;
  var confirmPw = confirmEl.value;

  if (!currentPw) { setState({ passwordChangeError: 'Current password is required.' }); return; }
  if (!newPw || newPw.length < 8) { setState({ passwordChangeError: 'New password must be at least 8 characters.' }); return; }
  if (newPw !== confirmPw) { setState({ passwordChangeError: 'New passwords do not match.' }); return; }
  if (newPw === currentPw) { setState({ passwordChangeError: 'New password must be different from current password.' }); return; }

  S.passwordChangeBusy = true;
  S.passwordChangeError = '';
  render();

  matrix.changePassword(currentPw, newPw)
    .then(function() {
      setState({ showPasswordChange: false, passwordChangeBusy: false, passwordChangeError: '' });
      toast('Password changed successfully.', 'success');
    })
    .catch(function(err) {
      var msg = 'Failed to change password.';
      if (err && err.errcode === 'M_FORBIDDEN') msg = 'Current password is incorrect.';
      else if (err && err.error) msg = err.error;
      setState({ passwordChangeBusy: false, passwordChangeError: msg });
    });
}

function handleForcedPasswordChange() {
  var currentEl = document.getElementById('fpw-current');
  var newEl = document.getElementById('fpw-new');
  var confirmEl = document.getElementById('fpw-confirm');
  if (!currentEl || !newEl || !confirmEl) return;

  var currentPw = currentEl.value;
  var newPw = newEl.value;
  var confirmPw = confirmEl.value;

  if (!currentPw) { setState({ passwordChangeError: 'Temporary password is required.' }); return; }
  if (!newPw || newPw.length < 8) { setState({ passwordChangeError: 'New password must be at least 8 characters.' }); return; }
  if (newPw !== confirmPw) { setState({ passwordChangeError: 'New passwords do not match.' }); return; }
  if (newPw === currentPw) { setState({ passwordChangeError: 'New password must be different from the temporary password.' }); return; }

  S.passwordChangeBusy = true;
  S.passwordChangeError = '';
  render();

  matrix.changePassword(currentPw, newPw)
    .then(function() {
      // Clear the mustChangePassword flag in the user's org room state
      var evt = matrix.getStateEvent(matrix.orgRoomId, EVT_USER, matrix.userId);
      var userContent = Object.assign({}, (evt && evt.content) || {});
      delete userContent.mustChangePassword;
      return matrix.sendStateEvent(matrix.orgRoomId, EVT_USER, userContent, matrix.userId);
    })
    .then(function() {
      setState({ mustChangePassword: false, passwordChangeBusy: false, passwordChangeError: '' });
      toast('Password set successfully. Welcome!', 'success');
    })
    .catch(function(err) {
      var msg = 'Failed to change password.';
      if (err && err.errcode === 'M_FORBIDDEN') msg = 'Temporary password is incorrect.';
      else if (err && err.error) msg = err.error;
      setState({ passwordChangeBusy: false, passwordChangeError: msg });
    });
}

// Compose and open a mailto: link to send login credentials to a user
function sendCredentialEmail(email, displayName, username, password) {
  var loginUrl = window.location.origin + window.location.pathname;
  var serverName = matrix.userId ? matrix.userId.split(':').slice(1).join(':') : CONFIG.MATRIX_SERVER_NAME;
  var subject = 'Your Amino Habeas Login Credentials';
  var body = 'Hello ' + displayName + ',\n\n' +
    'An account has been created for you on the Amino Immigration Habeas Petition System.\n\n' +
    'Login URL: ' + loginUrl + '\n' +
    'Username: ' + username + '\n';
  if (password) {
    body += 'Temporary Password: ' + password + '\n';
  } else {
    body += 'Temporary Password: (Please contact your administrator for your password)\n';
  }
  body += 'Server: ' + serverName + '\n\n' +
    'When you log in for the first time, you will be prompted to set a new password.\n\n' +
    'If you have any questions, please contact your administrator.\n\n' +
    'Best regards,\nAmino Immigration';
  var mailtoUrl = 'mailto:' + encodeURIComponent(email) +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
  window.open(mailtoUrl, '_blank');
}

function showAdminError(elementId, msg) {
  var el = document.getElementById(elementId);
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function handleAdminCreateUser() {
  var d = S.adminDraft;
  if (!d.username || !d.password) {
    showAdminError('admin-create-error', 'Username and password are required.');
    return;
  }

  // Extract server name from logged-in user's MXID to match Synapse's actual server_name
  var serverName = matrix.userId ? matrix.userId.split(':').slice(1).join(':') : CONFIG.MATRIX_SERVER_NAME;
  var mxid = '@' + d.username.trim() + ':' + serverName;
  var displayName = d.displayName || d.username;
  var role = d.role || 'attorney';
  var powerLevel = role === 'admin' ? 50 : 0;

  var createBtn = document.getElementById('admin-create-btn');
  if (createBtn) { createBtn.disabled = true; createBtn.textContent = 'Creating...'; }

  var email = (d.email || '').trim();

  // Helper: send the EVT_USER state event, auto-promoting room permissions if needed
  function setUserRole() {
    var content = {
      displayName: displayName,
      role: role,
      active: true,
      mustChangePassword: true,
    };
    if (email) content.email = email;
    return matrix.sendStateEvent(matrix.orgRoomId, EVT_USER, content, mxid);
  }

  // Step 1: Create account via Synapse admin API
  matrix.adminApi('PUT', '/v2/users/' + encodeURIComponent(mxid), {
    password: d.password,
    displayname: displayName,
    admin: false,
    deactivated: false,
  })
  .then(function() {
    // Step 2: Store role in !org room as EVT_USER state event
    // If this fails, try to auto-promote via make_room_admin and retry
    return setUserRole().catch(function(e) {
      if (S.isSynapseAdmin) {
        // Room permissions insufficient — use Synapse admin API to promote ourselves
        console.warn('setUserRole failed (status ' + (e && e.status) + '), trying makeRoomAdmin recovery:', e);
        return matrix.makeRoomAdmin(matrix.orgRoomId).then(function() {
          return setUserRole();
        });
      }
      throw e;
    });
  })
  .then(function() {
    // Step 3: Invite user to !org room
    return matrix.inviteUser(matrix.orgRoomId, mxid).catch(function(e) {
      if (e && e.errcode === 'M_FORBIDDEN') return;
      console.warn('Invite to org room failed:', e);
    });
  })
  .then(function() {
    // Step 4: Invite user to !templates room
    if (matrix.templatesRoomId) {
      return matrix.inviteUser(matrix.templatesRoomId, mxid).catch(function(e) {
        if (e && e.errcode === 'M_FORBIDDEN') return;
        console.warn('Invite to templates room failed:', e);
      });
    }
  })
  .then(function() {
    // Step 5: Set power levels in !org room
    return matrix.setPowerLevel(matrix.orgRoomId, mxid, powerLevel).catch(function(e) {
      console.warn('Set org power level failed:', e);
    });
  })
  .then(function() {
    // Step 6: Set power levels in !templates room
    if (matrix.templatesRoomId) {
      return matrix.setPowerLevel(matrix.templatesRoomId, mxid, powerLevel).catch(function(e) {
        console.warn('Set templates power level failed:', e);
      });
    }
  })
  .then(function() {
    // Update local state
    S.users[mxid] = {
      mxid: mxid,
      displayName: displayName,
      role: role,
      active: true,
      email: email,
      createdBy: S.currentUser,
      updatedAt: now(),
    };
    S.log.push({ op: 'CREATE', target: mxid, payload: displayName, frame: { t: now(), entity: 'user' } });
    // Prompt to send credentials via email
    if (email) {
      S._pendingCredentialEmail = { mxid: mxid, email: email, displayName: displayName, username: d.username.trim(), password: d.password };
    }
    setState({ adminEditUserId: null, adminDraft: {} });
    if (email) {
      toast('User created. Click "Send Credentials" to email login details.', 'success');
    } else {
      toast('User created. Share the password with the user manually.', 'success');
    }
  })
  .catch(function(err) {
    var msg = (err && err.error) || (err && err.message) || 'Failed to create user.';
    if (err && err.status === 403) {
      msg = 'Access denied. Your account may not have sufficient privileges. ';
      if (!S.isSynapseAdmin) {
        msg += 'Your account lacks Synapse server admin privileges. Create users via command line instead.';
      } else {
        msg += 'The Synapse account was created but room permissions could not be set. Try refreshing the page and re-opening the Admin panel.';
      }
    }
    showAdminError('admin-create-error', msg);
    if (createBtn) { createBtn.disabled = false; createBtn.textContent = 'Create Account'; }
  });
}

function handleAdminSaveUser() {
  var mxid = S.adminEditUserId;
  if (!mxid || mxid === 'new') return;
  var d = S.adminDraft;
  var displayName = d.displayName || mxid.replace(/@(.+):.*/, '$1');
  var role = d.role || 'attorney';
  var email = (d.email || '').trim();
  var powerLevel = role === 'admin' ? 50 : 0;

  var resettingPassword = !!(d.password && d.password.trim());

  // Helper: send the EVT_USER state event
  function setUserRole() {
    var content = {
      displayName: displayName,
      role: role,
      active: S.users[mxid] ? S.users[mxid].active : true,
    };
    if (email) content.email = email;
    // If admin is resetting the password, flag user to change it on next login
    if (resettingPassword) content.mustChangePassword = true;
    return matrix.sendStateEvent(matrix.orgRoomId, EVT_USER, content, mxid);
  }

  // Track results from independent operations
  var stateUpdateError = null;
  var passwordResetDone = false;

  // Update EVT_USER state event, auto-promoting room permissions if needed
  var roleChain = setUserRole().catch(function(e) {
    if (S.isSynapseAdmin) {
      console.warn('setUserRole failed (status ' + (e && e.status) + '), trying makeRoomAdmin recovery:', e);
      return matrix.makeRoomAdmin(matrix.orgRoomId).then(function() {
        return setUserRole();
      });
    }
    throw e;
  });

  // Update power levels in both rooms
  roleChain = roleChain.then(function() {
    return matrix.setPowerLevel(matrix.orgRoomId, mxid, powerLevel).catch(function(e) {
      console.warn('Set org PL failed:', e);
    });
  })
  .then(function() {
    if (matrix.templatesRoomId) {
      return matrix.setPowerLevel(matrix.templatesRoomId, mxid, powerLevel).catch(function(e) {
        console.warn('Set templates PL failed:', e);
      });
    }
  })
  .catch(function(e) {
    stateUpdateError = e;
    console.warn('State/PL update failed:', e);
  });

  // Password reset runs independently via Synapse admin API — not chained to state events
  var passwordChain = Promise.resolve();
  if (d.password && d.password.trim()) {
    passwordChain = matrix.adminApi('PUT', '/v2/users/' + encodeURIComponent(mxid), {
      password: d.password,
    }).then(function() {
      passwordResetDone = true;
    });
  }

  // Wait for both operations to settle
  Promise.all([roleChain, passwordChain.catch(function(e) { return e; })])
    .then(function(results) {
      var pwErr = (d.password && d.password.trim() && !passwordResetDone) ? results[1] : null;

      // Both failed
      if (stateUpdateError && pwErr) {
        var msg = 'Password reset failed: ' + ((pwErr && pwErr.error) || 'unknown error') +
          '. Role update also failed: ' + ((stateUpdateError && stateUpdateError.error) || 'unknown error');
        showAdminError('admin-edit-error', msg);
        return;
      }

      // Only password reset failed
      if (pwErr) {
        var msg = 'Password reset failed: ' + ((pwErr && pwErr.error) || 'unknown error') +
          '. Other changes were saved.';
        showAdminError('admin-edit-error', msg);
      }

      // Update local state for successful role/display changes
      if (!stateUpdateError) {
        S.users[mxid] = Object.assign({}, S.users[mxid], {
          displayName: displayName,
          role: role,
          email: email,
          updatedAt: now(),
        });
        S.log.push({ op: 'UPDATE', target: mxid, payload: role, frame: { t: now(), entity: 'user' } });
      }

      // If password reset succeeded (or wasn't requested), and state update may have failed
      if (stateUpdateError && !pwErr) {
        var errDetail = (stateUpdateError && (stateUpdateError.error || stateUpdateError.errcode || stateUpdateError.message)) || 'unknown error';
        // Password was reset successfully but state update failed
        if (passwordResetDone) {
          toast('Password reset OK. Role/display update failed: ' + errDetail, 'warning');
        } else {
          showAdminError('admin-edit-error', 'Failed to update user: ' + errDetail);
          return;
        }
      }

      if (passwordResetDone && !stateUpdateError) {
        toast('User updated and password reset successfully.', 'success');
      }

      setState({ adminEditUserId: null, adminDraft: {} });
    });
}

function handleAdminDeactivateUser(mxid) {
  function setUserDeactivated() {
    var content = {
      displayName: S.users[mxid] ? S.users[mxid].displayName : mxid,
      role: S.users[mxid] ? S.users[mxid].role : 'attorney',
      active: false,
    };
    if (S.users[mxid] && S.users[mxid].email) content.email = S.users[mxid].email;
    return matrix.sendStateEvent(matrix.orgRoomId, EVT_USER, content, mxid);
  }

  matrix.adminApi('POST', '/v1/deactivate/' + encodeURIComponent(mxid), { erase: false })
    .then(function() {
      return setUserDeactivated().catch(function(e) {
        if (S.isSynapseAdmin) {
          console.warn('setUserDeactivated failed (status ' + (e && e.status) + '), trying makeRoomAdmin recovery:', e);
          return matrix.makeRoomAdmin(matrix.orgRoomId).then(function() {
            return setUserDeactivated();
          });
        }
        throw e;
      });
    })
    .then(function() {
      if (S.users[mxid]) {
        S.users[mxid].active = false;
        S.users[mxid].updatedAt = now();
      }
      S.log.push({ op: 'DELETE', target: mxid, payload: null, frame: { t: now(), entity: 'user' } });
      setState({ adminEditUserId: null, adminDraft: {} });
    })
    .catch(function(err) {
      alert('Deactivation failed: ' + ((err && err.error) || 'unknown error'));
    });
}

function handleAdminAdoptUser(mxid) {
  var d = S.adminDraft;
  var displayName = d.displayName || mxid.replace(/@(.+):.*/, '$1');
  var role = d.role || 'attorney';
  var email = (d.email || '').trim();
  var powerLevel = role === 'admin' ? 50 : 0;
  var resettingPassword = !!(d.password && d.password.trim());

  // Helper: send the EVT_USER state event
  function setUserRole() {
    var content = {
      displayName: displayName,
      role: role,
      active: true,
    };
    if (email) content.email = email;
    if (resettingPassword) content.mustChangePassword = true;
    return matrix.sendStateEvent(matrix.orgRoomId, EVT_USER, content, mxid);
  }

  var stateUpdateError = null;
  var passwordResetDone = false;

  // Role/invite/PL chain — errors are captured, not thrown
  var roleChain = setUserRole().catch(function(e) {
    if (S.isSynapseAdmin) {
      console.warn('setUserRole failed (status ' + (e && e.status) + '), trying makeRoomAdmin recovery:', e);
      return matrix.makeRoomAdmin(matrix.orgRoomId).then(function() {
        return setUserRole();
      });
    }
    throw e;
  })
  .then(function() {
    return matrix.inviteUser(matrix.orgRoomId, mxid).catch(function(e) {
      if (e && e.errcode === 'M_FORBIDDEN') return;
      console.warn('Invite to org room failed:', e);
    });
  })
  .then(function() {
    if (matrix.templatesRoomId) {
      return matrix.inviteUser(matrix.templatesRoomId, mxid).catch(function(e) {
        if (e && e.errcode === 'M_FORBIDDEN') return;
        console.warn('Invite to templates room failed:', e);
      });
    }
  })
  .then(function() {
    return matrix.setPowerLevel(matrix.orgRoomId, mxid, powerLevel).catch(function(e) {
      console.warn('Set org PL failed:', e);
    });
  })
  .then(function() {
    if (matrix.templatesRoomId) {
      return matrix.setPowerLevel(matrix.templatesRoomId, mxid, powerLevel).catch(function(e) {
        console.warn('Set templates PL failed:', e);
      });
    }
  })
  .catch(function(e) {
    stateUpdateError = e;
    console.warn('Adopt state/PL update failed:', e);
  });

  // Password reset runs independently via Synapse admin API
  var passwordChain = Promise.resolve();
  if (d.password && d.password.trim()) {
    passwordChain = matrix.adminApi('PUT', '/v2/users/' + encodeURIComponent(mxid), {
      password: d.password,
    }).then(function() {
      passwordResetDone = true;
    });
  }

  Promise.all([roleChain, passwordChain.catch(function(e) { return e; })])
    .then(function(results) {
      var pwErr = (d.password && d.password.trim() && !passwordResetDone) ? results[1] : null;

      if (stateUpdateError && pwErr) {
        var msg = 'Adopt failed. Password: ' + ((pwErr && pwErr.error) || 'unknown error') +
          '. Role: ' + ((stateUpdateError && stateUpdateError.error) || 'unknown error');
        showAdminError('admin-adopt-error', msg);
        return;
      }

      if (pwErr) {
        showAdminError('admin-adopt-error', 'Password reset failed: ' + ((pwErr && pwErr.error) || 'unknown error') + '. Other changes were saved.');
      }

      if (!stateUpdateError) {
        S.users[mxid] = Object.assign({}, S.users[mxid], {
          displayName: displayName,
          role: role,
          email: email,
          active: true,
          managed: true,
          createdBy: S.currentUser,
          updatedAt: now(),
        });
        S.log.push({ op: 'ADOPT', target: mxid, payload: displayName, frame: { t: now(), entity: 'user' } });
      }

      if (stateUpdateError && !pwErr) {
        var errDetail = (stateUpdateError && (stateUpdateError.error || stateUpdateError.errcode || stateUpdateError.message)) || 'unknown error';
        if (passwordResetDone) {
          toast('Password reset OK. Role setup failed: ' + errDetail, 'warning');
        } else {
          showAdminError('admin-adopt-error', 'Failed to adopt user: ' + errDetail);
          return;
        }
      }

      if (!stateUpdateError) {
        toast('User ' + displayName + ' adopted successfully', 'success');
      }

      setState({ adminEditUserId: null, adminDraft: {} });
    });
}

// ── Flush pending syncs on visibility change / page unload ──────
// When the user switches tabs or is about to leave, immediately fire
// any pending debounced syncs (best-effort — fetch may be cancelled)
function flushPendingSyncs() {
  // Blur active field to trigger its change event (saves pending edits)
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
  var keys = Object.keys(_syncTimers);
  if (keys.length === 0) return;
  // Set _flushing = true so fetch uses keepalive (browser won't cancel on unload).
  // Do NOT reset _flushing to false here — the async fetch calls are still in flight.
  // It will be reset on next normal API call or page load.
  matrix._flushing = true;
  keys.forEach(function(key) {
    var entry = _syncTimers[key];
    clearTimeout(entry.timer);
    entry.fn();
  });
  _syncTimers = {};
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') flushPendingSyncs();
});
window.addEventListener('beforeunload', flushPendingSyncs);

// ── Initialization ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  render(); // Show loading state immediately
  if (matrix.loadSession()) {
    // First verify the token is still valid with /whoami
    matrix.whoami()
      .then(function(whoamiData) {
        console.log('Session verified for:', whoamiData.user_id);
        // Ensure userId matches what we have stored
        if (whoamiData.user_id) matrix.userId = whoamiData.user_id;
        return matrix.initialSync();
      })
      .then(function() {
        S.authenticated = true;
        S.loading = false;
        return hydrateFromMatrix();
      })
      .then(function() { render(); matrix.startLongPoll(); toast('Session restored', 'info'); })
      .catch(function(err) {
        console.error('Session restore failed:', err);
        var status = (err && err.status) || 0;
        // On 401/403 (invalid token), clear session and show login
        if (status === 401 || status === 403) {
          console.warn('Token invalid or expired, clearing session');
          matrix.clearSession();
          S.loading = false;
          render();
          return;
        }
        // On network errors or 502/503/504, enter offline mode
        // Keep session so user can retry, but let them work locally
        S.authenticated = true;
        S.loading = false;
        S.syncError = 'Could not reach the Matrix server (' + ((err && err.error) || 'network error') + '). Working in local-only mode \u2014 changes will not sync.';
        S.currentUser = matrix.userId || 'local';
        S.role = 'attorney';
        render();
      });
  } else {
    S.loading = false;
    render();
  }
});

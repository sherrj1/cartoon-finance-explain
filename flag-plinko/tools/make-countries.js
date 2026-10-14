// Generates data/countries.json: 193 UN members + 2 UN observers + 2 popular extras = 197.
// Format per line: code|Display name|comma-separated chat aliases (optional)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const RAW = `
af|Afghanistan
al|Albania
dz|Algeria
ad|Andorra
ao|Angola
ag|Antigua and Barbuda|antigua,barbuda
ar|Argentina
am|Armenia
au|Australia|aussie
at|Austria|osterreich
az|Azerbaijan
bs|Bahamas|the bahamas
bh|Bahrain
bd|Bangladesh
bb|Barbados
by|Belarus
be|Belgium|belgie,belgique
bz|Belize
bj|Benin
bt|Bhutan
bo|Bolivia
ba|Bosnia and Herzegovina|bosnia,herzegovina
bw|Botswana
br|Brazil|brasil
bn|Brunei
bg|Bulgaria
bf|Burkina Faso
bi|Burundi
cv|Cabo Verde|cape verde
kh|Cambodia
cm|Cameroon
ca|Canada
cf|Central African Republic|car
td|Chad
cl|Chile
cn|China|prc
co|Colombia
km|Comoros
cg|Congo|republic of the congo,congo-brazzaville
cd|DR Congo|dr congo,drc,democratic republic of the congo,congo-kinshasa
cr|Costa Rica
ci|Ivory Coast|cote d'ivoire,cote divoire
hr|Croatia|hrvatska
cu|Cuba
cy|Cyprus
cz|Czechia|czech republic,czech
dk|Denmark
dj|Djibouti
dm|Dominica
do|Dominican Republic|dominicana
ec|Ecuador
eg|Egypt
sv|El Salvador
gq|Equatorial Guinea
er|Eritrea
ee|Estonia
sz|Eswatini|swaziland
et|Ethiopia
fj|Fiji
fi|Finland|suomi
fr|France
ga|Gabon
gm|Gambia|the gambia
ge|Georgia
de|Germany|deutschland
gh|Ghana
gr|Greece
gd|Grenada
gt|Guatemala
gn|Guinea
gw|Guinea-Bissau|guinea bissau
gy|Guyana
ht|Haiti
hn|Honduras
hu|Hungary
is|Iceland
in|India
id|Indonesia
ir|Iran
iq|Iraq
ie|Ireland
il|Israel
it|Italy|italia
jm|Jamaica
jp|Japan
jo|Jordan
kz|Kazakhstan
ke|Kenya
ki|Kiribati
kp|North Korea|dprk
kr|South Korea|korea,republic of korea
kw|Kuwait
kg|Kyrgyzstan
la|Laos
lv|Latvia
lb|Lebanon
ls|Lesotho
lr|Liberia
ly|Libya
li|Liechtenstein
lt|Lithuania
lu|Luxembourg
mg|Madagascar
mw|Malawi
my|Malaysia
mv|Maldives
ml|Mali
mt|Malta
mh|Marshall Islands
mr|Mauritania
mu|Mauritius
mx|Mexico
fm|Micronesia
md|Moldova
mc|Monaco
mn|Mongolia
me|Montenegro
ma|Morocco
mz|Mozambique
mm|Myanmar|burma
na|Namibia
nr|Nauru
np|Nepal
nl|Netherlands|holland,nederland
nz|New Zealand
ni|Nicaragua
ne|Niger
ng|Nigeria
mk|North Macedonia|macedonia
no|Norway|norge
om|Oman
pk|Pakistan
pw|Palau
pa|Panama
pg|Papua New Guinea|png
py|Paraguay
pe|Peru
ph|Philippines
pl|Poland|polska
pt|Portugal
qa|Qatar
ro|Romania
ru|Russia
rw|Rwanda
kn|Saint Kitts and Nevis|st kitts,saint kitts
lc|Saint Lucia|st lucia
vc|Saint Vincent and the Grenadines|st vincent,saint vincent
ws|Samoa
sm|San Marino
st|Sao Tome and Principe|sao tome
sa|Saudi Arabia|saudi
sn|Senegal
rs|Serbia
sc|Seychelles
sl|Sierra Leone
sg|Singapore
sk|Slovakia
si|Slovenia
sb|Solomon Islands
so|Somalia
za|South Africa
ss|South Sudan
es|Spain|espana
lk|Sri Lanka
sd|Sudan
sr|Suriname
se|Sweden|sverige
ch|Switzerland|swiss
sy|Syria
tj|Tajikistan
tz|Tanzania
th|Thailand
tl|Timor-Leste|east timor
tg|Togo
to|Tonga
tt|Trinidad and Tobago|trinidad,tobago
tn|Tunisia
tr|Turkey|turkiye
tm|Turkmenistan
tv|Tuvalu
ug|Uganda
ua|Ukraine
ae|United Arab Emirates|uae,emirates
gb|United Kingdom|uk,britain,great britain,england,scotland,wales
us|United States|usa,america,united states of america,us of a
uy|Uruguay
uz|Uzbekistan
vu|Vanuatu
ve|Venezuela
vn|Vietnam|viet nam
ye|Yemen
zm|Zambia
zw|Zimbabwe
va|Vatican City|vatican,holy see
ps|Palestine
tw|Taiwan
xk|Kosovo
`;

const list = RAW.trim().split('\n').map((l) => {
  const [code, name, aliases = ''] = l.split('|');
  return { code, name, aliases: aliases ? aliases.split(',') : [] };
});

const codes = new Set(list.map((c) => c.code));
if (codes.size !== list.length) throw new Error('duplicate codes');
if (list.length !== 197) throw new Error(`expected 197 countries, got ${list.length}`);

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/countries.json'), JSON.stringify(list, null, 1));
console.log(`wrote data/countries.json (${list.length} countries)`);

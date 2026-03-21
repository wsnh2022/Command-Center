/**
 * IconPicker.tsx
 * Modal for selecting an icon — 6 tabs per ICON_SYSTEM.md §5.
 *
 * Tabs: Auto | Emoji | Library | Upload | URL | Base64
 *
 * On confirm: calls onSelect({ iconPath, iconSource }) — caller updates item state.
 * On cancel:  calls onClose() — no disk writes occur.
 *
 * All disk writes happen only when user clicks "Use Icon".
 * Preview (URL / upload) fetches/reads to memory only.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, RefreshCw, Upload, Smile, Library } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import { ipc } from '../../utils/ipc'
import type { IconSource, ItemType } from '../../types'

export interface IconSelection {
  iconPath:    string
  iconSource:  IconSource
  previewUri?: string   // base64 data URI for upload/url/base64 — used in form preview before save
  iconColor?:  string   // library only — hex colour e.g. '#6366f1', or '' for default
}

interface IconPickerProps {
  currentIconPath:   string
  currentIconSource: IconSource
  currentIconColor?: string   // seeds the colour picker when editing an existing library icon
  itemType?:         ItemType  // optional — omit for non-item contexts (e.g. groups)
  itemUrl?:          string   // needed for Auto tab re-fetch
  hideTabs?:         TabId[]  // tabs to suppress (e.g. ['auto'] for groups)
  onSelect:          (selection: IconSelection) => void
  onClose:           () => void
}

type TabId = 'auto' | 'emoji' | 'library' | 'file'

// ─── Full icon name list derived from dynamicIconImports ────────────────────
// Converts kebab-case keys ('git-branch') to PascalCase ('GitBranch').
// Computed once at module load — no network, no async, no maintenance.
function kebabToPascal(kebab: string): string {
  return kebab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

// All 1460 PascalCase icon names from lucide-react v0.378.0.
// Derived from the real dynamicIconImports keys — no regex toKebab conversion,
// so all 8 edge-case icons (ArrowDown01, Grid2x2, etc.) resolve correctly.
const ALL_ICON_NAMES: string[] = Object.keys(dynamicIconImports).map(kebabToPascal)

// All icons shown by default.
const DEFAULT_ICONS = ALL_ICON_NAMES

// Max results when user is searching
const SEARCH_LIMIT = 200

// Virtual scroll constants
const COLS        = 10          // must match gridTemplateColumns repeat()
const CELL_SIZE   = 40          // px — w-9 (36) + gap-1 (4)
const BUFFER_ROWS = 4           // extra rows rendered above + below viewport

// ─── Emoji dataset ────────────────────────────────────────────────────────────
// Grouped by category — common emoji for a productivity launcher context
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Common',   emojis: ['⭐','🔥','✅','❌','⚡','🎯','🚀','💡','🔑','🛡️','📌','🔔','💬','📧','🗂️','📁','📂','💾','🖥️','⌨️','🖱️','🖨️','🔐','🔒','🔓','⚠️','🚨','✨','💫','🎉','🏆','🥇','🎖️','🏅','💎','👑','🎁','🎀','🧩','🪄'] },
  { label: 'Dev',      emojis: ['💻','🖥️','⌨️','🖱️','🔧','🔩','⚙️','🛠️','🔬','🧪','🧬','📡','📟','💡','🔌','🔋','💿','📀','🗜️','🖧','📲','📱','🤖','👾','🕹️','🎮','🧮','📟','🛰️','🔭','🔦','🧲','🪛','🪚','🔑','🗝️','🔐','💊','🧰','📦','🗳️','📬','🖨️','🖲️','💽'] },
  { label: 'Work',     emojis: ['📋','📊','📈','📉','🗒️','📝','✏️','🖊️','🖋️','📎','📐','📏','🗓️','📅','📆','📌','📍','🗃️','🗄️','🗑️','📤','📥','📨','📩','📬','📭','📮','🗳️','✉️','📃','📄','📑','📜','📒','📓','📔','📕','📗','📘','📙','📚','🔖','🏷️','💼','👔','🤝','📞','☎️','📠'] },
  { label: 'Finance',  emojis: ['💰','💵','💴','💶','💷','💸','💳','🏦','📊','📈','📉','🪙','💱','💲','🏧','🤑','💹','🧾','⚖️','🏪','🏬','🛒','🛍️','🎰','🤝','📑','💼','🗂️','🔏'] },
  { label: 'Media',    emojis: ['🎵','🎶','🎬','🎥','📷','📸','📹','🎙️','🎚️','🎛️','🎤','🎧','🎼','🎞️','📻','📺','🎮','🕹️','🎭','🎨','🖼️','🎪','🎠','🎡','🎢','🎟️','🎫','🎗️','📽️','🎦','🔊','🔉','🔈','🔇','📢','📣','🔔','🔕','🎺','🎸','🎹','🎻','🥁','🪘','🪗','🪕','🎷'] },
  { label: 'People',   emojis: ['👤','👥','🧑','👨','👩','🧒','👶','🧓','👴','👵','🙋','🙆','🙅','🤷','🤦','💁','🙎','🙍','🧑‍💻','👨‍💻','👩‍💻','🧑‍🔧','👨‍🔬','👩‍🔬','🧑‍🎨','👨‍🏫','👩‍🏫','🧑‍💼','👮','🕵️','💂','🧙','🦸','🦹','🧝','🧑‍🚀','👷','🎅','🤶'] },
  { label: 'Faces',    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿'] },
  { label: 'Hands',    emojis: ['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','💪','🦾','🤝','🙏','✍️','💅','🤳','👏','🙌','👐','🤲','🫶','🫱','🫲','🫳','🫴','🤜','🤛','👊','✊','🤞','👋','🤙','🖕'] },
  { label: 'Animals',  emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐟','🐠','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️'] },
  { label: 'Food',     emojis: ['🍕','🍔','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍷','🥂','🍸','🍹','🧃','🥤','🧋','☕','🍵','🧉','🍺','🍻','🥃','🫖','🧊'] },
  { label: 'Travel',   emojis: ['🌍','🌎','🌏','🗺️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','🗼','🗽','⛪','🕌','🛕','⛩️','🕍','🗻','🏔️','⛰️','🌋','🗾','🏕️','🏖️','🏜️','🏝️','🏞️','🌄','🌅','🌆','🌇','🌃','🌉','✈️','🛩️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🚢','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🏎️','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🛞','🚨','🚥','🚦','🛑','🚧'] },
  { label: 'Nature',   emojis: ['🌿','🌱','🌲','🌳','🌴','🌵','🎋','🎍','🍀','🍁','🍂','🍃','🌾','🌸','🌹','🥀','🌺','🌻','🌼','🌷','🪷','🪴','🌙','🌛','🌜','🌝','🌞','⭐','🌟','💫','✨','🌠','⛅','🌤️','🌥️','🌦️','🌧️','⛈️','🌩️','🌪️','🌫️','🌬️','🌈','☀️','🌊','💧','💦','🔥','❄️','⛄','🌀','🌈','⚡','🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌙','🌚','🌍','🌏','🌎','🪐','💥','🌌','🌠','☄️'] },
  { label: 'Objects',  emojis: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💰','💵','💴','💶','💷','🪙','💸','💳','🧾','📊','📈','📉','📋','📌','📍','🗺️','🧭','🔭','🔬','🧬','🩺','💊','🩹','🩼','🩺','🏋️','🎒','💼','👝','👛','👓','🕶️','🥽','🌂','☂️','☔','⛱️','⚡','❄️','🔑','🗝️','🔐','🔒','🔓','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🛡️','🔧','🔩','⚙️','🗜️','🔗','⛓️','🧲','🪝','🧰','🪜','🧱'] },
  { label: 'Symbols',  emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','✡️','🔯','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🔀','🔁','🔂','▶️','⏩','⏭️','⏯️','◀️','⏪','⏮️','🔼','⏫','🔽','⏬','⏸️','⏹️','⏺️','🎦','🔅','🔆','📶','🛜','📳','📴','📵','📡','♻️','🔱','📛','🔰','⭕','✅','☑️','✔️','❌','❎','➕','➖','➗','✖️','🟰','♾️','💲','💱','⚕️','🔃','🔄','🔙','🔚','🔛','🔜','🔝','🔰','🆗','🆕','🆙','🆓','🆒','🆖','🅰️','🅱️','🆎','🆑','🅾️','🆘','❓','❔','❕','❗','🔅','🔆','🔱','⚜️','🏁','🚩','🎌','🏴','🏳️'] },
  { label: 'Sports',   emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪀','🪆','🎮','🎲','♟️','🎭','🎨','🖼️','🎰','🚵','🏇','🤸','🏋️','🤼','🤺','🤾','🏌️','🏄','🚣','🧗','🏊','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎟️','🎫','🎪'] },
]

// Flat emoji keyword index — used for text search (e.g. "smile", "fire", "dog").
// Format: each entry is "emoji keywords…" separated by spaces.
// Emojis not listed here are still reachable by browsing/category-name search.
const EMOJI_KEYWORD_INDEX: [string, string][] = [
  // Faces — positive
  ['😀','smile grin happy face'],['😃','smile happy grin big eyes'],['😄','smile laugh happy'],['😁','grin beam smile'],['😆','laugh squint haha'],['😅','sweat laugh nervous relief'],['🤣','rofl laugh rolling floor'],['😂','joy laugh cry tears'],['🙂','slight smile'],['🙃','upside down smile flip'],['😉','wink'],['😊','blush smile happy rosy'],['😇','halo angel innocent saint'],['🥰','love hearts adore smiling'],['😍','heart eyes love'],['🤩','star eyes amazing wow'],['😘','kiss blow love'],['😚','kiss closed eyes'],['🥲','smile tear grateful'],['😋','yum tongue tasty'],['😛','tongue out silly'],['😜','wink tongue playful'],['🤪','crazy wacky zany'],['😝','tongue squint silly'],
  // Faces — neutral/negative
  ['🤔','thinking hmm ponder'],['🤐','zip mouth quiet secret'],['🤨','skeptical raised eyebrow'],['😐','neutral blank'],['😑','expressionless'],['😶','no mouth silent'],['😏','smirk sly'],['😒','unamused annoyed'],['🙄','roll eyes'],['😬','grimace awkward nervous'],['😌','relieved peaceful calm'],['😔','pensive sad thoughtful'],['😪','sleepy tired yawn'],['😴','sleep tired zzz snore'],['😷','mask sick face'],['🤒','sick thermometer ill'],['🤕','hurt injury bandage'],['🤢','nausea sick green vomit'],['🤧','sneeze sick tissues cold'],['🥵','hot sweat fever overheated'],['🥶','cold freeze shiver'],['🥴','woozy dizzy drunk'],['😵','dizzy spiral faint'],['🤯','mind blown explosion'],['🤠','cowboy hat western'],['🥳','party celebrate birthday'],['😎','cool sunglasses calm'],['🤓','nerd glasses smart'],['🧐','monocle inspect curious'],['😕','confused unsure'],['😟','worried concerned'],['🙁','frown slight sad'],['☹️','frown sad unhappy'],['😮','open mouth surprise oh'],['😲','astonished shocked wow'],['😳','flushed blush embarrassed'],['🥺','pleading sad puppy eyes'],['😨','fearful scared frightened'],['😰','anxious cold sweat worried'],['😢','cry tear sad'],['😭','sob cry loud tears'],['😱','scream fear horror gasp'],['😤','triumph huff steam proud'],['😡','angry mad red pouting'],['😠','angry mad'],['🤬','cursing swear rage'],['😈','devil evil grin imp'],
  // Hands & gestures
  ['👍','thumbs up like ok approve'],['👎','thumbs down dislike no'],['👌','ok perfect fine circle'],['✌️','peace victory two fingers'],['🤞','fingers crossed luck hope'],['👋','wave hello bye hand'],['💪','muscle strong flex bicep'],['🤝','handshake deal agree'],['🙏','pray thanks please hands folded'],['👏','clap applause bravo'],['🤜','fist bump right'],['👊','punch fist'],
  // Hearts & love
  ['❤️','heart love red'],['🧡','heart orange'],['💛','heart yellow'],['💚','heart green'],['💙','heart blue'],['💜','heart purple'],['🖤','heart black'],['🤍','heart white'],['💔','broken heart sad'],['💕','hearts two love'],['💖','sparkling heart'],['💘','heart arrow cupid'],['💝','heart ribbon gift'],
  // Common symbols
  ['⭐','star yellow'],['🌟','star glowing shine'],['💫','dizzy star spin'],['✨','sparkles magic star'],['🔥','fire hot flame burn'],['❄️','snow cold ice winter'],['💧','water drop blue'],['🌊','wave ocean sea'],['⚡','lightning bolt electric fast'],['🌈','rainbow color arch'],['☀️','sun sunny bright hot'],['🌙','moon night crescent'],['💥','explosion boom bang'],
  // Common UI / productivity
  ['🎯','target dart bullseye focus'],['🚀','rocket launch space fast'],['💡','idea lightbulb bright'],['🔑','key lock access'],['🛡️','shield protect security'],['📌','pin pushpin location'],['🔔','bell notification alert'],['💬','chat bubble speech talk'],['📧','email letter message'],['📁','folder file directory'],['📂','open folder file'],['💾','save disk floppy'],['🖥️','desktop computer screen monitor'],['⌨️','keyboard type'],['🖱️','mouse cursor click pointer'],['💻','laptop computer'],['📱','phone mobile device'],['⚙️','gear settings config cog'],['🔧','wrench tool fix repair'],['🔩','bolt nut screw'],['🛠️','tools build repair'],['🔬','microscope science lab'],['🧪','test tube experiment lab'],['📊','bar chart graph data'],['📈','chart up growth increase'],['📉','chart down decline decrease'],['📝','memo note pencil write'],['✏️','pencil write edit draw'],['🗓️','calendar date schedule plan'],['📅','calendar date event'],['🏆','trophy winner champion award'],['🥇','gold medal first place'],['💎','diamond gem precious'],['👑','crown royal king queen'],['🎁','gift present box'],['🎉','party celebrate confetti'],['🎊','confetti celebrate party'],['🧩','puzzle piece fit'],['⚠️','warning caution danger'],['✅','check tick done complete'],['❌','cross wrong error fail'],['❓','question mark unknown'],
  // Tech & dev
  ['🤖','robot ai machine bot'],['👾','alien monster game pixel'],['🛰️','satellite orbit space'],['🔭','telescope stars space astronomy'],['🧲','magnet attract stick'],['🪛','screwdriver tool'],['🗝️','old key lock'],['🧰','toolbox kit repair'],['📦','box package cargo'],['💽','disk storage minidisk'],['💿','cd disc music data'],['📀','dvd disc'],
  // Nature & animals
  ['🌿','plant leaf green herb'],['🌱','seedling sprout grow'],['🌲','pine tree evergreen'],['🌳','tree deciduous'],['🌸','blossom cherry pink flower'],['🌹','rose flower red'],['🌻','sunflower yellow flower'],['🌼','blossom yellow flower'],['🍀','clover luck green'],['🐶','dog puppy pet animal'],['🐱','cat kitten pet animal'],['🦁','lion king animal'],['🐯','tiger stripe animal'],['🐻','bear animal'],['🦊','fox animal red'],['🦋','butterfly insect flutter'],['🐦','bird tweet animal'],['🦅','eagle bird'],['🐬','dolphin ocean sea'],['🦈','shark ocean sea'],['🐢','turtle slow green'],['🐍','snake reptile'],['🌵','cactus desert plant'],
  // Food & drink
  ['🍕','pizza food'],['🍔','burger hamburger fast food'],['☕','coffee hot drink morning'],['🍵','tea hot drink'],['🍺','beer drink cheers'],['🍷','wine drink red'],['🍰','cake slice dessert sweet'],['🎂','birthday cake celebrate'],['🍎','apple red fruit'],['🍌','banana yellow fruit'],['🍓','strawberry fruit red'],['🍕','pizza slice cheese'],
  // Travel & places
  ['✈️','plane airplane travel fly'],['🚗','car auto vehicle drive'],['🚀','rocket space launch'],['🏠','home house building'],['🏢','office building'],['🌍','earth globe world map'],['🗺️','map world globe'],['🏖️','beach sand sun vacation'],['🏔️','mountain peak snow'],['🌆','city buildings sunset'],
  // Activities & sports
  ['⚽','soccer football sport ball'],['🏀','basketball sport ball'],['🎮','game controller play video'],['🕹️','joystick arcade game'],['🎨','art palette paint creative'],['🎬','movie film clapper cinema'],['📷','camera photo picture'],['🎵','music note song'],['🎶','music notes melody'],['🎸','guitar music rock'],['🎹','piano keys music'],['🥁','drum beat music'],
]

// Build a fast lookup: Map<emoji, keywords>
const _EMOJI_KW_MAP = new Map(EMOJI_KEYWORD_INDEX.map(([e, k]) => [e, k]))

// Comprehensive display name map — covers every emoji in every EMOJI_GROUP.
// Single source of truth for tooltip names.
const EMOJI_NAMES: Record<string, string> = {
  // ── Common ──
  '⭐':'Star','🔥':'Fire','✅':'Check','❌':'Cross','⚡':'Lightning','🎯':'Target',
  '🚀':'Rocket','💡':'Idea','🔑':'Key','🛡️':'Shield','📌':'Pin','🔔':'Bell',
  '💬':'Chat','📧':'Email','🗂️':'Card index','📁':'Folder','📂':'Open folder',
  '💾':'Save','🖥️':'Desktop','⌨️':'Keyboard','🖱️':'Mouse','🖨️':'Printer',
  '🔐':'Lock key','🔒':'Lock','🔓':'Unlock','⚠️':'Warning','🚨':'Siren',
  '✨':'Sparkles','💫':'Dizzy star','🎉':'Party','🏆':'Trophy','🥇':'Gold medal',
  '🎖️':'Medal','🏅':'Sports medal','💎':'Diamond','👑':'Crown','🎁':'Gift',
  '🎀':'Bow ribbon','🧩':'Puzzle','🪄':'Magic wand',
  // ── Dev ──
  '💻':'Laptop','🔧':'Wrench','🔩':'Bolt','⚙️':'Gear','🛠️':'Tools',
  '🔬':'Microscope','🧪':'Test tube','🧬':'DNA','📡':'Satellite dish','📟':'Pager',
  '🔌':'Plug','🔋':'Battery','💿':'CD','📀':'DVD','🗜️':'Clamp',
  '🖧':'Network','📲':'Phone call','📱':'Phone','🤖':'Robot','👾':'Alien monster',
  '🕹️':'Joystick','🎮':'Game controller','🧮':'Abacus','🛰️':'Satellite',
  '🔭':'Telescope','🔦':'Flashlight','🧲':'Magnet','🪛':'Screwdriver','🪚':'Saw',
  '🗝️':'Old key','💊':'Pill','🧰':'Toolbox','📦':'Box','🗳️':'Ballot box',
  '📬':'Mailbox','🖲️':'Trackball','💽':'Minidisc',
  // ── Work ──
  '📋':'Clipboard','📊':'Bar chart','📈':'Chart up','📉':'Chart down',
  '🗒️':'Notepad','📝':'Memo','✏️':'Pencil','🖊️':'Pen','🖋️':'Fountain pen',
  '📎':'Paperclip','📐':'Set square','📏':'Ruler','🗓️':'Spiral calendar',
  '📅':'Calendar','📆':'Tear calendar','📍':'Round pin','🗃️':'Card box',
  '🗄️':'Filing cabinet','🗑️':'Wastebasket','📤':'Outbox','📥':'Inbox',
  '📨':'Incoming envelope','📩':'Envelope arrow','📭':'Empty mailbox','📮':'Post box',
  '✉️':'Envelope','📃':'Page curl','📄':'Document','📑':'Bookmark tabs',
  '📜':'Scroll','📒':'Notebook','📓':'Memo book','📔':'Decorated book',
  '📕':'Red book','📗':'Green book','📘':'Blue book','📙':'Orange book',
  '📚':'Books','🔖':'Bookmark','🏷️':'Label','💼':'Briefcase','👔':'Necktie',
  '🤝':'Handshake','📞':'Receiver','☎️':'Telephone','📠':'Fax',
  // ── Finance ──
  '💰':'Money bag','💵':'Dollar','💴':'Yen','💶':'Euro','💷':'Pound',
  '💸':'Flying money','💳':'Credit card','🏦':'Bank','🪙':'Coin','💱':'Exchange',
  '💲':'Dollar sign','🏧':'ATM','🤑':'Money face','💹':'Chart yen','🧾':'Receipt',
  '⚖️':'Scales','🏪':'Store','🏬':'Mall','🛒':'Shopping cart','🛍️':'Shopping bags',
  '🎰':'Slot machine','🔏':'Lock pen',
  // ── Media ──
  '🎵':'Music note','🎶':'Music notes','🎬':'Clapperboard','🎥':'Movie camera',
  '📷':'Camera','📸':'Camera flash','📹':'Video camera','🎙️':'Studio mic',
  '🎚️':'Level slider','🎛️':'Control knobs','🎤':'Microphone','🎧':'Headphones',
  '🎼':'Sheet music','🎞️':'Film strip','📻':'Radio','📺':'Television',
  '🎭':'Theater','🎨':'Art palette','🖼️':'Frame picture','🎪':'Circus tent',
  '🎠':'Carousel','🎡':'Ferris wheel','🎢':'Roller coaster','🎟️':'Admission ticket',
  '🎫':'Ticket','🎗️':'Ribbon','📽️':'Film projector','🎦':'Cinema',
  '🔊':'Speaker high','🔉':'Speaker medium','🔈':'Speaker low','🔇':'Muted',
  '📢':'Megaphone','📣':'Horn','🔕':'No bell','🎺':'Trumpet','🎸':'Guitar',
  '🎹':'Piano','🎻':'Violin','🥁':'Drums','🪘':'Bongo drums','🪗':'Accordion',
  '🪕':'Banjo','🎷':'Saxophone',
  // ── People ──
  '👤':'Silhouette','👥':'Group','🧑':'Person','👨':'Man','👩':'Woman',
  '🧒':'Child','👶':'Baby','🧓':'Older person','👴':'Old man','👵':'Old woman',
  '🙋':'Raising hand','🙆':'OK gesture','🙅':'No gesture','🤷':'Shrug',
  '🤦':'Facepalm','💁':'Info desk','🙎':'Pouting person','🙍':'Frowning person',
  '🧑‍💻':'Coder','👨‍💻':'Male coder','👩‍💻':'Female coder','🧑‍🔧':'Technician',
  '👨‍🔬':'Scientist','👩‍🔬':'Scientist','🧑‍🎨':'Artist','👨‍🏫':'Teacher',
  '👩‍🏫':'Teacher','🧑‍💼':'Office worker','👮':'Police','🕵️':'Detective',
  '💂':'Guard','🧙':'Mage','🦸':'Superhero','🦹':'Villain','🧝':'Elf',
  '🧑‍🚀':'Astronaut','👷':'Construction worker','🎅':'Santa','🤶':'Mrs Claus',
  // ── Faces — positive ──
  '😀':'Grinning','😃':'Big smile','😄':'Smile laugh','😁':'Grin beam',
  '😆':'Laugh squint','😅':'Nervous laugh','🤣':'Rolling laugh','😂':'Tears of joy',
  '🙂':'Slight smile','🙃':'Upside down','😉':'Wink','😊':'Blush smile',
  '😇':'Halo angel','🥰':'Love hearts','😍':'Heart eyes','🤩':'Star eyes',
  '😘':'Kiss blow','😗':'Kiss','😚':'Kiss closed','😙':'Kiss smile',
  '🥲':'Smile tear','😋':'Yum','😛':'Tongue out','😜':'Wink tongue',
  '🤪':'Wacky','😝':'Tongue squint','🤗':'Hugging',
  '🤭':'Giggling','🤫':'Shushing','🤔':'Thinking',
  // ── Faces — neutral/negative ──
  '🤐':'Zipper mouth','🤨':'Raised brow','😐':'Neutral','😑':'Expressionless',
  '😶':'No mouth','😏':'Smirking','😒':'Unamused','🙄':'Eye roll','😬':'Grimacing',
  '🤥':'Lying','😌':'Relieved','😔':'Pensive','😪':'Sleepy','🤤':'Drooling',
  '😴':'Sleeping','😷':'Face mask','🤒':'Sick','🤕':'Hurt','🤢':'Nausea',
  '🤧':'Sneezing','🥵':'Overheated','🥶':'Freezing','🥴':'Woozy','😵':'Dizzy',
  '🤯':'Mind blown','🤠':'Cowboy','🥳':'Party face','🥸':'Disguised',
  '😎':'Cool shades','🤓':'Nerd','🧐':'Monocle','😕':'Confused','😟':'Worried',
  '🙁':'Slight frown','☹️':'Frown','😮':'Open mouth','😯':'Hushed',
  '😲':'Astonished','😳':'Flushed','🥺':'Pleading','😦':'Frown open',
  '😧':'Anguished','😨':'Fearful','😰':'Cold sweat','😥':'Disappointed sad',
  '😢':'Crying','😭':'Sobbing','😱':'Screaming','😖':'Confounded',
  '😣':'Persevering','😞':'Disappointed','😓':'Downcast sweat','😩':'Weary',
  '😫':'Tired','🥱':'Yawning','😤':'Triumph','😡':'Angry red','😠':'Angry',
  '🤬':'Cursing','😈':'Smiling devil','👿':'Angry devil',
  // ── Hands ──
  '👍':'Thumbs up','👎':'Thumbs down','👌':'OK hand','🤌':'Pinched fingers',
  '✌️':'Victory','🤞':'Crossed fingers','🤟':'Love you','🤘':'Rock on',
  '🤙':'Call me','👈':'Point left','👉':'Point right','👆':'Point up',
  '👇':'Point down','☝️':'Index up','👋':'Wave','🤚':'Back hand',
  '🖐️':'Open hand','✋':'Stop hand','🖖':'Vulcan salute','💪':'Muscle',
  '🦾':'Mechanical arm','🤳':'Selfie','👏':'Clap','🙌':'Raised hands',
  '👐':'Open hands','🤲':'Palms up','🫶':'Heart hands','🫱':'Hand right',
  '🫲':'Hand left','🫳':'Palm down','🫴':'Palm up','🤜':'Right fist',
  '🤛':'Left fist','👊':'Punch','✊':'Raised fist',
  '✍️':'Writing hand','💅':'Nail polish','🖕':'Middle finger',
  // ── Animals ──
  '🐶':'Dog','🐱':'Cat','🐭':'Mouse','🐹':'Hamster','🐰':'Rabbit',
  '🦊':'Fox','🐻':'Bear','🐼':'Panda','🐨':'Koala','🐯':'Tiger',
  '🦁':'Lion','🐮':'Cow','🐷':'Pig','🐸':'Frog','🐵':'Monkey',
  '🐔':'Chicken','🐧':'Penguin','🐦':'Bird','🐤':'Chick','🦆':'Duck',
  '🦅':'Eagle','🦉':'Owl','🦇':'Bat','🐺':'Wolf','🐗':'Boar',
  '🐴':'Horse','🦄':'Unicorn','🐝':'Bee','🐛':'Caterpillar','🦋':'Butterfly',
  '🐌':'Snail','🐞':'Ladybug','🐜':'Ant','🦟':'Mosquito','🦗':'Cricket',
  '🦂':'Scorpion','🐢':'Turtle','🐍':'Snake','🦎':'Lizard','🦖':'T-Rex',
  '🦕':'Sauropod','🐙':'Octopus','🦑':'Squid','🦐':'Shrimp','🦞':'Lobster',
  '🦀':'Crab','🐡':'Blowfish','🐟':'Fish','🐠':'Tropical fish','🐬':'Dolphin',
  '🐳':'Spouting whale','🐋':'Whale','🦈':'Shark','🐊':'Crocodile','🐅':'Tiger',
  '🐆':'Leopard','🦓':'Zebra','🦍':'Gorilla','🦧':'Orangutan','🦣':'Mammoth',
  '🐘':'Elephant','🦛':'Hippo','🦏':'Rhino','🐪':'Camel','🐫':'Two-hump camel',
  '🦒':'Giraffe','🦘':'Kangaroo','🦬':'Bison','🐃':'Water buffalo','🐂':'Ox',
  '🐄':'Cow','🐎':'Racing horse','🐖':'Pig','🐏':'Ram','🐑':'Ewe',
  '🦙':'Llama','🐐':'Goat','🦌':'Deer','🐕':'Dog','🐩':'Poodle',
  '🦮':'Guide dog','🐕‍🦺':'Service dog','🐈':'Cat','🐈‍⬛':'Black cat',
  '🪶':'Feather','🐓':'Rooster','🦃':'Turkey','🦤':'Dodo','🦚':'Peacock',
  '🦜':'Parrot','🦢':'Swan','🦩':'Flamingo','🕊️':'Dove',
  // ── Food ──
  '🍕':'Pizza','🍔':'Burger','🌮':'Taco','🌯':'Burrito','🥙':'Wrap',
  '🧆':'Falafel','🥚':'Egg','🍳':'Frying pan','🥘':'Paella','🍲':'Stew',
  '🫕':'Fondue','🥣':'Bowl','🥗':'Salad','🍿':'Popcorn','🧂':'Salt',
  '🥫':'Canned food','🍱':'Bento box','🍘':'Rice cracker','🍙':'Rice ball',
  '🍚':'Cooked rice','🍛':'Curry','🍜':'Noodles','🍝':'Spaghetti',
  '🍠':'Sweet potato','🍢':'Oden','🍣':'Sushi','🍤':'Fried shrimp',
  '🍥':'Fish cake','🥮':'Mooncake','🍡':'Dango','🥟':'Dumpling',
  '🥠':'Fortune cookie','🥡':'Takeout box','🍦':'Soft ice cream',
  '🍧':'Shaved ice','🍨':'Ice cream','🍩':'Doughnut','🍪':'Cookie',
  '🎂':'Birthday cake','🍰':'Cake slice','🧁':'Cupcake','🥧':'Pie',
  '🍫':'Chocolate','🍬':'Candy','🍭':'Lollipop','🍮':'Custard',
  '🍯':'Honey pot','🍷':'Wine','🥂':'Champagne','🍸':'Cocktail',
  '🍹':'Tropical drink','🧃':'Juice box','🥤':'Cup with straw',
  '🧋':'Bubble tea','☕':'Coffee','🍵':'Tea','🧉':'Mate','🍺':'Beer',
  '🍻':'Cheers','🥃':'Whiskey','🫖':'Teapot','🧊':'Ice cube',
  // ── Travel ──
  '🌍':'Earth Europe','🌎':'Earth Americas','🌏':'Earth Asia','🗺️':'World map',
  '🏠':'House','🏡':'House garden','🏢':'Office','🏣':'Post office',
  '🏤':'EU post office','🏥':'Hospital','🏨':'Hotel',
  '🏩':'Love hotel','🏫':'School','🏭':'Factory',
  '🏯':'Japanese castle','🏰':'Castle','🗼':'Tokyo tower','🗽':'Statue liberty',
  '⛪':'Church','🕌':'Mosque','🛕':'Hindu temple','⛩️':'Shinto shrine',
  '🕍':'Synagogue','🗻':'Mount Fuji','🏔️':'Snow mountain','⛰️':'Mountain',
  '🌋':'Volcano','🗾':'Japan map','🏕️':'Camping','🏖️':'Beach','🏜️':'Desert',
  '🏝️':'Island','🏞️':'Park','🌄':'Sunrise mountain','🌅':'Sunrise',
  '🌆':'City sunset','🌇':'City dusk','🌃':'Night stars','🌉':'Bridge night',
  '✈️':'Airplane','🛩️':'Small plane','🚁':'Helicopter','🛸':'UFO',
  '🛶':'Canoe','⛵':'Sailboat','🚤':'Speedboat','🛥️':'Motor boat','🚢':'Ship',
  '🚂':'Locomotive','🚃':'Train car','🚄':'Bullet train','🚅':'Shinkansen',
  '🚆':'Train','🚇':'Metro','🚈':'Light rail','🚉':'Station','🚊':'Tram',
  '🚝':'Monorail','🚞':'Mountain railway','🚋':'Tram car','🚌':'Bus',
  '🚍':'Oncoming bus','🚎':'Trolleybus','🏎️':'Racing car','🚑':'Ambulance',
  '🚒':'Fire engine','🚓':'Police car','🚔':'Oncoming police','🚕':'Taxi',
  '🚖':'Oncoming taxi','🚗':'Car','🚘':'Oncoming car','🚙':'SUV',
  '🛻':'Pickup truck','🚚':'Truck','🚛':'Semi truck','🚜':'Tractor',
  '🏍️':'Motorcycle','🛵':'Scooter','🚲':'Bicycle','🛴':'Kick scooter',
  '🛹':'Skateboard','🛼':'Roller skate','🚏':'Bus stop','🛣️':'Highway',
  '🛤️':'Railway','⛽':'Gas pump','🛞':'Wheel','🚥':'Traffic lights',
  '🚦':'Traffic light','🛑':'Stop sign','🚧':'Construction',
  // ── Nature ──
  '🌿':'Herb','🌱':'Seedling','🌲':'Pine tree','🌳':'Tree','🌴':'Palm tree',
  '🌵':'Cactus','🎋':'Bamboo','🎍':'Pine decor','🍀':'Four leaf clover',
  '🍁':'Maple leaf','🍂':'Fallen leaf','🍃':'Leaves','🌾':'Wheat','🌸':'Cherry blossom',
  '🌹':'Rose','🥀':'Wilted rose','🌺':'Hibiscus','🌻':'Sunflower','🌼':'Blossom',
  '🌷':'Tulip','🪷':'Lotus','🪴':'Potted plant','🌙':'Crescent moon',
  '🌛':'Quarter moon','🌜':'Quarter moon','🌝':'Full moon face','🌞':'Sun face',
  '🌟':'Glowing star','🌠':'Shooting star',
  '⛅':'Partly cloudy','🌤️':'Sun cloud','🌥️':'Overcast','🌦️':'Rain shower',
  '🌧️':'Rain','⛈️':'Thunderstorm','🌩️':'Lightning','🌪️':'Tornado',
  '🌫️':'Fog','🌬️':'Wind','🌈':'Rainbow','☀️':'Sun','🌊':'Wave',
  '💧':'Droplet','💦':'Splash','❄️':'Snowflake','⛄':'Snowman',
  '🌀':'Cyclone','🌑':'New moon','🌒':'Waxing crescent','🌓':'First quarter',
  '🌔':'Waxing gibbous','🌕':'Full moon','🌖':'Waning gibbous','🌗':'Last quarter',
  '🌘':'Waning crescent','🌚':'New moon face','🪐':'Planet','💥':'Explosion','🌌':'Galaxy','☄️':'Comet',
  // ── Objects ──
  '⌚':'Watch','🧭':'Compass','⏱️':'Stopwatch','⏲️':'Timer','⏰':'Alarm clock',
  '🕰️':'Mantel clock','⌛':'Hourglass done','⏳':'Hourglass','🪫':'Low battery',
  '🕯️':'Candle','🪔':'Diya lamp','🧯':'Fire extinguisher','🛢️':'Oil drum',
  '🩺':'Stethoscope','🩹':'Bandage','🩼':'Crutch','🎒':'Backpack',
  '👝':'Clutch bag','👛':'Purse','👓':'Glasses','🕶️':'Sunglasses',
  '🥽':'Goggles','🌂':'Umbrella closed','☂️':'Umbrella','☔':'Umbrella rain',
  '⛱️':'Beach umbrella','🔨':'Hammer','🪓':'Axe','⛏️':'Pickaxe',
  '⚒️':'Hammer pick','🗡️':'Dagger','⚔️':'Swords','🔗':'Link',
  '⛓️':'Chains','🪝':'Hook','🪜':'Ladder','🧱':'Brick',
  // ── Symbols ──
  '❤️':'Red heart','🧡':'Orange heart','💛':'Yellow heart','💚':'Green heart',
  '💙':'Blue heart','💜':'Purple heart','🖤':'Black heart','🤍':'White heart',
  '🤎':'Brown heart','💔':'Broken heart','❣️':'Heart exclamation','💕':'Two hearts',
  '💞':'Revolving hearts','💓':'Heartbeat','💗':'Growing heart','💖':'Sparkling heart',
  '💘':'Heart arrow','💝':'Heart ribbon','💟':'Heart decoration',
  '☮️':'Peace','✝️':'Cross','☪️':'Star crescent','🕉️':'Om',
  '✡️':'Star of David','🔯':'Six-pointed star','☯️':'Yin yang',
  '☦️':'Orthodox cross','🛐':'Worship','⛎':'Ophiuchus',
  '♈':'Aries','♉':'Taurus','♊':'Gemini','♋':'Cancer','♌':'Leo',
  '♍':'Virgo','♎':'Libra','♏':'Scorpio','♐':'Sagittarius','♑':'Capricorn',
  '♒':'Aquarius','♓':'Pisces','🔀':'Shuffle','🔁':'Repeat','🔂':'Repeat once',
  '▶️':'Play','⏩':'Fast forward','⏭️':'Next','⏯️':'Play pause',
  '◀️':'Reverse','⏪':'Rewind','⏮️':'Previous','🔼':'Up',
  '⏫':'Fast up','🔽':'Down','⏬':'Fast down','⏸️':'Pause',
  '⏹️':'Stop','⏺️':'Record','🔅':'Dim','🔆':'Bright',
  '📶':'Signal','🛜':'Wireless','📳':'Vibrate mode','📴':'Off mode',
  '📵':'No phone','♻️':'Recycle','🔱':'Trident','📛':'Name badge',
  '🔰':'Beginner','⭕':'Red circle','☑️':'Check box',
  '✔️':'Check','❎':'Cross box','➕':'Plus','➖':'Minus',
  '➗':'Divide','✖️':'Multiply','🟰':'Equals','♾️':'Infinity',
  '⚕️':'Medical symbol',
  '🔃':'Clockwise','🔄':'Counterclockwise','🔙':'Back','🔚':'End',
  '🔛':'On','🔜':'Soon','🔝':'Top','🆗':'OK','🆕':'New','🆙':'Up',
  '🆓':'Free','🆒':'Cool','🆖':'NG','🅰️':'Blood A','🅱️':'Blood B',
  '🆎':'AB','🆑':'CL','🅾️':'Blood O','🆘':'SOS','❓':'Question',
  '❔':'White question','❕':'White exclamation','❗':'Exclamation',
  '⚜️':'Fleur-de-lis','🏁':'Checkered flag','🚩':'Red flag',
  '🎌':'Crossed flags','🏴':'Black flag','🏳️':'White flag',
  // ── Sports ──
  '⚽':'Soccer','🏀':'Basketball','🏈':'Football','⚾':'Baseball',
  '🥎':'Softball','🎾':'Tennis','🏐':'Volleyball','🏉':'Rugby','🥏':'Disc',
  '🎱':'Billiards','🏓':'Table tennis','🏸':'Badminton','🏒':'Ice hockey',
  '🏑':'Field hockey','🥍':'Lacrosse','🏏':'Cricket','🪃':'Boomerang',
  '🥅':'Goal net','⛳':'Golf','🪁':'Yo-yo','🏹':'Bow and arrow',
  '🎣':'Fishing','🤿':'Scuba','🎽':'Running shirt','🎿':'Skis','🛷':'Sled',
  '🥌':'Curling stone','🪀':'Yo-yo toy','🪆':'Matryoshka','🎲':'Dice',
  '♟️':'Chess pawn','🚵':'Mountain bike','🏇':'Horse racing',
  '🤸':'Cartwheel','🏋️':'Weight lifting','🤼':'Wrestling','🤺':'Fencing',
  '🤾':'Handball','🏌️':'Golf swing','🏄':'Surfing','🚣':'Rowing',
  '🧗':'Climbing','🏊':'Swimming','🚴':'Cycling',
  '🥈':'Silver medal','🥉':'Bronze medal',
}

// Look up display name — single map, no chaining needed.
function getEmojiName(emoji: string): string {
  return EMOJI_NAMES[emoji] ?? emoji
}

// ─── Preview box ──────────────────────────────────────────────────────────────

interface PreviewBoxProps {
  iconPath:    string
  iconSource:  IconSource
  previewUri?: string   // base64 data URI (for URL/upload preview before save)
  iconColor?:  string   // applied to library icon preview
}

function PreviewBox({ iconPath, iconSource, previewUri, iconColor }: PreviewBoxProps) {
  const src = previewUri ?? (iconPath ? `command-center-asset://${iconPath}` : '')

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-surface-3 border border-surface-4 mx-auto shrink-0">
      {iconSource === 'emoji' && iconPath ? (
        <span className="text-3xl leading-none">{iconPath}</span>
      ) : iconSource === 'library' && iconPath ? (
        <LibraryIconPreview name={iconPath} size={32} color={iconColor} />
      ) : src ? (
        <img
          src={src}
          alt="icon preview"
          className={[
            'w-10 h-10 object-contain rounded-sm',
            (iconSource === 'favicon' || iconSource === 'auto') ? 'bg-white' : '',
          ].join(' ')}
        />
      ) : (
        <span className="text-text-muted text-xs text-center px-1">No icon</span>
      )}
    </div>
  )
}

function LibraryIconPreview({ name, size, color }: { name: string; size: number; color?: string }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => {
    if (!name) return
    loadLucideIcon(name).then(setIcon)
  }, [name])
  if (!icon) return <span className="text-text-muted text-xs">{name}</span>
  const Icon = icon
  // Apply stored colour as inline style if set; otherwise fall back to CSS class
  const style = color ? { color } : undefined
  const cls   = color ? undefined : 'text-text-secondary'
  return <Icon size={size} className={cls} style={style} strokeWidth={1.5} />
}

// ─── Main component ───────────────────────────────────────────────────────────

function sourceToTab(source: IconSource, hideTabs?: TabId[]): TabId {
  const preferred: TabId =
    source === 'library'  ? 'library' :
    source === 'emoji'    ? 'emoji'   :
    source === 'url-icon' ? 'file'    :
    source === 'b64-icon' ? 'file'    :
    source === 'custom'   ? 'file'    :
    'auto'  // favicon / auto
  if (hideTabs?.includes(preferred)) {
    const order: TabId[] = ['auto', 'emoji', 'library', 'file']
    return order.find(t => !hideTabs.includes(t)) ?? 'auto'
  }
  return preferred
}

export default function IconPicker({
  currentIconPath, currentIconSource, currentIconColor, itemType = 'url', itemUrl, hideTabs, onSelect, onClose,
}: IconPickerProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() => sourceToTab(currentIconSource, hideTabs))

  // Pending selection — not committed until "Use Icon" is clicked
  const [pendingPath,   setPendingPath]   = useState(currentIconPath)
  const [pendingSource, setPendingSource] = useState<IconSource>(currentIconSource)
  const [previewUri,    setPreviewUri]    = useState<string | undefined>(undefined)
  const [pendingColor,  setPendingColor]  = useState(currentIconColor ?? '')   // seeded from item on edit
  // Pre-mark as selected whenever there is an existing icon — user can re-confirm or just
  // change colour (library) without having to re-pick the icon from scratch.
  const [hasSelection,  setHasSelection]  = useState(!!currentIconPath)
  const [busy,          setBusy]          = useState(false)
  const [error,         setError]         = useState('')

  function markSelected(path: string, source: IconSource, preview?: string) {
    setPendingPath(path)
    setPendingSource(source)
    setPreviewUri(preview)
    // Clear colour when switching away from library
    if (source !== 'library') setPendingColor('')
    setHasSelection(true)
    setError('')
  }

  async function handleConfirm() {
    if (!hasSelection) { onClose(); return }
    setBusy(true)
    setError('')
    let succeeded = false
    try {
      onSelect({
        iconPath:   pendingPath,
        iconSource: pendingSource,
        previewUri,
        iconColor:  pendingSource === 'library' ? pendingColor : '',
      })
      succeeded = true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply icon')
    } finally {
      setBusy(false)
      // Close on success; keep picker open on error so user can see the message
      if (succeeded) onClose()
    }
  }

  const TABS: { id: TabId; label: string; Icon: React.FC<{ size: number; className: string }> }[] = [
    { id: 'auto',    label: 'Auto',    Icon: (p) => <RefreshCw  {...p} /> },
    { id: 'emoji',   label: 'Emoji',   Icon: (p) => <Smile      {...p} /> },
    { id: 'library', label: 'Library', Icon: (p) => <Library    {...p} /> },
    { id: 'file',    label: 'File',    Icon: (p) => <Upload     {...p} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface-2 rounded-lg shadow-panel border border-surface-4 flex flex-col"
        style={{ width: 480, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-4 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Choose Icon</h2>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-surface-4 shrink-0 px-3 pt-2 gap-0.5">
          {TABS.filter(t => !hideTabs?.includes(t.id)).map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setError('') }}
              className={[
                'px-3 h-8 rounded-t-btn text-xs transition-base duration-base border-b-2 whitespace-nowrap',
                activeTab === t.id
                  ? 'text-text-primary border-accent'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-3',
              ].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">

          {/* Live preview */}
          <PreviewBox iconPath={pendingPath} iconSource={pendingSource} previewUri={previewUri} iconColor={pendingColor} />

          {error && (
            <div className="px-3 py-2 rounded-input bg-danger/10 text-danger text-xs">{error}</div>
          )}

          {/* Tab content */}
          {activeTab === 'auto' && (
            <AutoTab itemType={itemType} itemUrl={itemUrl}
              onSelect={(path, src) => markSelected(path, src)} setError={setError} setBusy={setBusy} />
          )}
          {activeTab === 'emoji' && (
            <EmojiTab onSelect={(emoji) => markSelected(emoji, 'emoji')} />
          )}
          {activeTab === 'library' && (
            <LibraryTab
              onSelect={(name) => markSelected(name, 'library')}
              selected={pendingSource === 'library' ? pendingPath : ''}
              color={pendingColor}
              onColorChange={(c) => { setPendingColor(c); setHasSelection(true) }}
            />
          )}
          {activeTab === 'file' && (
            <FileTab
              onSelect={markSelected}
              setError={setError}
              currentPath={pendingSource === 'custom' || pendingSource === 'url-icon' || pendingSource === 'b64-icon' ? pendingPath : ''}
              currentPreviewUri={previewUri}
              currentSource={pendingSource}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-surface-4 px-5 py-4 flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="h-8 px-4 text-sm rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={busy || !hasSelection}
            className="h-8 px-4 text-sm rounded-btn font-medium text-text-inverse bg-accent hover:bg-accent-hover transition-base duration-base disabled:opacity-40">
            {busy ? 'Applying…' : 'Use Icon'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Auto ────────────────────────────────────────────────────────────────

interface AutoTabProps {
  itemType: ItemType
  itemUrl?: string
  onSelect: (path: string, source: IconSource) => void
  setError: (e: string) => void
  setBusy:  (b: boolean) => void
}

function AutoTab({ itemType, itemUrl, onSelect, setError, setBusy }: AutoTabProps) {
  const [manualUrl, setManualUrl] = useState('')
  const [fetching,  setFetching]  = useState(false)
  const [fetchMsg,  setFetchMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  async function handleReset() {
    if (!itemUrl) { onSelect('', 'auto'); return }
    setBusy(true)
    try {
      const result = await ipc.icons.fetchFavicon(itemUrl)
      onSelect(result.localPath, result.localPath ? 'favicon' : 'auto')
    } catch {
      setError('Could not fetch favicon — using type icon')
      onSelect('', 'auto')
    } finally { setBusy(false) }
  }

  async function handleManualFetch() {
    const raw = manualUrl.trim()
    if (!raw) return
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw
    setFetching(true)
    setBusy(true)
    setFetchMsg(null)
    try {
      const result = await ipc.icons.fetchFavicon(url)
      if (result.localPath) {
        onSelect(result.localPath, 'favicon')
        setFetchMsg({ ok: true, text: 'Favicon fetched — click Use Icon to confirm.' })
      } else {
        setFetchMsg({ ok: false, text: 'No favicon found for this URL.' })
      }
    } catch {
      setFetchMsg({ ok: false, text: 'Failed to fetch favicon.' })
    } finally { setFetching(false); setBusy(false) }
  }

  // Auto-fetch on mount so the preview populates immediately when the tab opens
  useEffect(() => {
    if (itemType === 'url' && itemUrl) handleReset()
  }, [])  // mount-only — itemUrl is stable for the lifetime of this modal instance

  return (
    <div className="flex flex-col gap-4">

      {/* Auto-fetch for URL items ───────────────────────────── */}
      {itemType === 'url' && itemUrl && (
        <div className="flex flex-col gap-2 text-center">
          <p className="text-xs text-text-secondary leading-relaxed">
            Automatically fetches the favicon for this item's URL.
          </p>
          <button onClick={handleReset}
            className="self-center flex items-center gap-2 px-3 h-8 rounded-btn text-xs border border-surface-4 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
            <RefreshCw size={12} /> Re-fetch Favicon
          </button>
        </div>
      )}

      {/* Divider ────────────────────────────────────────────── */}
      {itemType === 'url' && itemUrl && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-surface-4" />
          <span className="text-[10px] text-text-muted uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-surface-4" />
        </div>
      )}

      {/* Manual URL fetch ───────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-text-secondary">Fetch favicon from any website:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualUrl}
            onChange={e => { setManualUrl(e.target.value); setFetchMsg(null) }}
            onKeyDown={e => e.key === 'Enter' && !fetching && handleManualFetch()}
            placeholder="github.com"
            className="flex-1 h-8 px-3 text-xs bg-surface-2 border border-surface-4 rounded-btn
                       text-text-primary placeholder:text-text-muted outline-none
                       focus:border-brand transition-colors"
          />
          <button
            onClick={handleManualFetch}
            disabled={fetching || !manualUrl.trim()}
            className="h-8 px-3 text-xs bg-surface-3 border border-surface-4 rounded-btn
                       text-text-secondary hover:text-text-primary hover:bg-surface-4
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-base duration-base flex items-center gap-1.5 flex-shrink-0"
          >
            <RefreshCw size={11} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching…' : 'Fetch'}
          </button>
        </div>

        {fetchMsg && (
          <p className={`text-[11px] ${fetchMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {fetchMsg.text}
          </p>
        )}

        <p className="text-[10px] text-text-muted">
          Powered by favicon.vemetric.com · 64 × 64 PNG · saved locally
        </p>
      </div>
    </div>
  )
}

// ─── Tab: Emoji ───────────────────────────────────────────────────────────────

function EmojiTab({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()

  // Keyword search: find emojis whose indexed keywords include the query
  const keywordResults: string[] = query
    ? EMOJI_KEYWORD_INDEX
        .filter(([, k]) => k.includes(query))
        .map(([e]) => e)
    : []

  // Category search: filter groups whose label matches the query
  const categoryResults = query
    ? EMOJI_GROUPS.filter(g => g.label.toLowerCase().includes(query))
    : EMOJI_GROUPS

  // Only show "use as icon" when the input actually contains emoji characters
  const hasEmoji = /\p{Emoji_Presentation}/u.test(search.trim())

  const emojiBtn = (emoji: string) => (
    <button
      key={emoji}
      onClick={() => onSelect(emoji)}
      className="group relative flex items-center justify-center text-xl
        border-r border-b border-surface-4
        hover:bg-surface-3 transition-colors duration-100"
      style={{ width: 44, height: 44 }}
    >
      {emoji}
      {/* Hover popup — emoji scaled up + name */}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30
        flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg
        bg-surface-1 border border-surface-4 shadow-md whitespace-nowrap
        opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="text-2xl leading-none">{emoji}</span>
        <span className="text-[11px] text-text-secondary">{getEmojiName(emoji)}</span>
      </span>
    </button>
  )

  // Grid wrapper — border-l + border-t form the left/top of the net;
  // each cell contributes border-r + border-b to complete every cell box.
  const emojiGrid = (emojis: string[]) => (
    <div
      className="border-l border-t border-surface-4 overflow-visible"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 44px)' }}
    >
      {emojis.map(emojiBtn)}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search or paste an emoji…"
        className="h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base" />

      {hasEmoji && (
        <button onClick={() => onSelect(search.trim())}
          className="self-start flex items-center gap-2 px-3 h-8 rounded-btn text-xs border border-accent bg-accent-soft text-text-primary transition-base duration-base">
          Use "{search.trim()}" as icon
        </button>
      )}

      {/* Keyword search results */}
      {query && keywordResults.length > 0 && (
        <div>
          <p className="text-[12px] text-text-muted mb-2 uppercase tracking-wide">Results</p>
          {emojiGrid(keywordResults)}
        </div>
      )}

      {/* Category groups */}
      {(!query || categoryResults.length > 0) && categoryResults.map(group => (
        <div key={group.label}>
          <p className="text-[12px] text-text-muted mb-2 uppercase tracking-wide">{group.label}</p>
          {emojiGrid(group.emojis)}
        </div>
      ))}

      {query && keywordResults.length === 0 && categoryResults.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">No emojis found for "{search}"</p>
      )}
    </div>
  )
}

// ─── Tab: Library ─────────────────────────────────────────────────────────────

// Colour presets — same palette as ColorPicker.tsx
const ICON_COLOR_PRESETS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
]

function LibraryTab({
  onSelect, selected, color, onColorChange,
}: {
  onSelect: (name: string) => void
  selected: string
  color: string
  onColorChange: (c: string) => void
}) {
  const [search, setSearch] = useState('')
  const lower = search.trim().toLowerCase()

  const toShow = lower
    ? ALL_ICON_NAMES.filter(n => n.toLowerCase().includes(lower)).slice(0, SEARCH_LIMIT)
    : DEFAULT_ICONS

  // ── Virtual scroll state ────────────────────────────────────────────────
  const scrollRef    = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(400)

  // Observe container height on mount and whenever it changes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewHeight(el.clientHeight))
    ro.observe(el)
    setViewHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)
  }, [])

  // Derived virtual window
  const totalRows  = Math.ceil(toShow.length / COLS)
  const firstRow   = Math.max(0, Math.floor(scrollTop / CELL_SIZE) - BUFFER_ROWS)
  const visibleRows= Math.ceil(viewHeight / CELL_SIZE) + BUFFER_ROWS * 2
  const lastRow    = Math.min(totalRows - 1, firstRow + visibleRows)
  const firstIdx   = firstRow * COLS
  const lastIdx    = Math.min(toShow.length - 1, (lastRow + 1) * COLS - 1)
  const paddingTop = firstRow * CELL_SIZE
  const paddingBot = Math.max(0, (totalRows - lastRow - 1)) * CELL_SIZE
  const visible    = toShow.slice(firstIdx, lastIdx + 1)

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setScrollTop(0) }}
          placeholder={`Search ${ALL_ICON_NAMES.length} icons…`}
          autoFocus
          className="flex-1 h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base"
        />
        {lower && (
          <span className="text-[12px] text-text-muted shrink-0">
            {toShow.length}{toShow.length === SEARCH_LIMIT ? '+' : ''} result{toShow.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Scrollable virtual viewport — fixed height so parent modal controls overall height */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ height: 360 }}
      >
        {/* Spacer above rendered rows */}
        {paddingTop > 0 && <div style={{ height: paddingTop }} />}

        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {visible.map(name => (
            <LibraryGridItem key={name} name={name} active={selected === name} onSelect={onSelect} />
          ))}
        </div>

        {/* Spacer below rendered rows */}
        {paddingBot > 0 && <div style={{ height: paddingBot }} />}
      </div>

      {lower && toShow.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">No icons match "{search}"</p>
      )}

      {/* ── Icon Colour ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 pt-1 border-t border-surface-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted uppercase tracking-wide">Icon Colour</span>
          {color && (
            <button
              onClick={() => onColorChange('')}
              className="text-[12px] text-text-muted hover:text-text-secondary transition-base duration-base"
            >
              Reset
            </button>
          )}
        </div>

        {/* Row 1: 12 preset swatches */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ICON_COLOR_PRESETS.map(preset => (
            <button
              key={preset}
              title={preset}
              onClick={() => onColorChange(color === preset ? '' : preset)}
              className="w-6 h-6 rounded-btn border-2 transition-base duration-base shrink-0"
              style={{
                backgroundColor: preset,
                borderColor:     color === preset ? '#fff'        : 'transparent',
                boxShadow:       color === preset ? `0 0 0 1px ${preset}` : 'none',
              }}
            />
          ))}
        </div>

        {/* Row 2: custom swatch preview + hex input */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-btn shrink-0 border border-surface-4"
            style={{ backgroundColor: color && !ICON_COLOR_PRESETS.includes(color) ? color : 'transparent' }}
          />
          <input
            type="text"
            value={ICON_COLOR_PRESETS.includes(color) ? '' : color}
            onChange={e => {
              const v = e.target.value.trim()
              if (!v) { onColorChange(''); return }
              const hex = v.startsWith('#') ? v : `#${v}`
              if (/^#[0-9a-fA-F]{0,6}$/.test(hex)) onColorChange(hex)
            }}
            onBlur={e => {
              const v = e.target.value.trim()
              if (!v) return
              const hex = v.startsWith('#') ? v : `#${v}`
              if (!/^#[0-9a-fA-F]{6}$/.test(hex)) onColorChange('')
            }}
            placeholder="Custom hex e.g. #a3e635"
            maxLength={7}
            className="flex-1 h-6 px-2 text-xs font-mono bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base"
          />
        </div>
      </div>
    </div>
  )
}

// Async icon grid button — only renders when scrolled into view (virtual scroll).
// Icon loads once on mount; cache in lucide-registry means instant on revisit.
function LibraryGridItem({ name, active, onSelect }: { name: string; active: boolean; onSelect: (n: string) => void }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => { loadLucideIcon(name).then(setIcon) }, [name])
  const Icon = icon
  return (
    <button
      onClick={() => onSelect(name)}
      className={[
        'group relative flex items-center justify-center rounded-btn transition-base duration-base',
        'focus:outline-none',
        active
          ? 'bg-accent-soft text-text-primary'
          : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
      ].join(' ')}
      style={{ width: CELL_SIZE - 4, height: CELL_SIZE - 4 }}
    >
      {/* Icon or loading skeleton */}
      {Icon
        ? <Icon size={16} strokeWidth={1.75} />
        : <span className="w-4 h-4 rounded-sm bg-surface-4 animate-pulse" />
      }
      {/* Hover label — tooltip chip, floats above sibling rows via z-10 */}
      <span className={[
        'absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5',
        'text-[11px] leading-tight text-text-primary bg-surface-1 border border-surface-4',
        'rounded shadow-md whitespace-nowrap pointer-events-none z-20',
        'transition-opacity duration-fast',
        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      ].join(' ')}>
        {name}
      </span>
    </button>
  )
}

// ─── Tab: File (Upload + URL + Base64 unified) ────────────────────────────────

interface TabSelectProps {
  onSelect: (path: string, source: IconSource, previewUri?: string) => void
  setError: (e: string) => void
}

function detectInputType(value: string): 'url' | 'base64' | null {
  const v = value.trim()
  if (!v) return null
  if (v.startsWith('http://') || v.startsWith('https://')) return 'url'
  if (v.startsWith('data:image/')) return 'base64'
  if (v.length > 80 && /^[A-Za-z0-9+/=\r\n]+$/.test(v.replace(/\s/g, ''))) return 'base64'
  return null
}

function FileTab({ onSelect, setError, currentPath, currentPreviewUri, currentSource }: TabSelectProps & {
  currentPath?:       string
  currentPreviewUri?: string
  currentSource?:     IconSource
}) {
  const [inputValue,   setInputValue]   = useState('')
  const [isExpanded,   setIsExpanded]   = useState(false)
  const [busy,         setBusy]         = useState(false)
  const [faviconUrl,   setFaviconUrl]   = useState('')
  const [faviconBusy,  setFaviconBusy]  = useState(false)
  const [faviconMsg,   setFaviconMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const imgSrc   = currentPreviewUri ?? (currentPath ? `command-center-asset://${currentPath}` : '')
  const filename = currentPath ? currentPath.split('/').pop() ?? currentPath : ''

  function handleInput(value: string) {
    setInputValue(value)
    setError('')

    const detected = detectInputType(value)
    // Auto-expand to textarea when base64 is pasted or input is very long
    setIsExpanded(detected === 'base64' || value.length > 100)

    if (detected === 'base64') {
      const isDataUri  = value.trim().startsWith('data:image/')
      const previewUri = isDataUri ? value.trim() : `data:image/png;base64,${value.trim()}`
      onSelect(value.trim(), 'b64-icon', previewUri)
      return
    }

    if (detected === 'url') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchUrl(value.trim()), 600)
    }
  }

  async function fetchUrl(url: string) {
    setBusy(true)
    setError('')
    try {
      const { dataUri } = await ipc.icons.previewUrl(url)
      onSelect(url, 'url-icon', dataUri)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load image from URL')
    } finally { setBusy(false) }
  }

  async function handleBrowse() {
    const result = await ipc.system.showOpenDialog({
      type: 'file',
      title: 'Select Icon',
      filters: [{ name: 'Images', extensions: ['png', 'svg', 'jpg', 'jpeg', 'ico'] }],
    })
    if (!result) return
    setBusy(true)
    try {
      const { dataUri } = await ipc.icons.previewLocal(result)
      onSelect(result, 'custom', dataUri)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read file')
    } finally { setBusy(false) }
  }

  async function handleFaviconFetch() {
    const raw = faviconUrl.trim()
    if (!raw) return
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw
    setFaviconBusy(true)
    setFaviconMsg(null)
    setError('')
    try {
      const result = await ipc.icons.fetchFavicon(url)
      if (result.localPath) {
        onSelect(result.localPath, 'favicon')
        setFaviconMsg({ ok: true, text: 'Favicon saved — click Use Icon to confirm.' })
      } else {
        const msg = 'No favicon found for this URL.'
        setFaviconMsg({ ok: false, text: msg })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch favicon.'
      setFaviconMsg({ ok: false, text: msg })
      setError(msg)
    } finally { setFaviconBusy(false) }
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const detected = detectInputType(inputValue)

  return (
    <div className="flex flex-col gap-3">

      {/* Current icon row — shown when editing an existing file-sourced icon */}
      {currentPath && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-3 border border-surface-4">
          {imgSrc && (
            <img src={imgSrc} className="w-9 h-9 object-contain rounded-sm shrink-0" alt="" />
          )}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs text-text-primary font-medium">Current icon</span>
            <span className="text-[11px] text-text-muted truncate">
              {currentSource === 'custom'
                ? filename
                : 'Original URL/data not stored — paste a new one to replace'}
            </span>
          </div>
        </div>
      )}

      {/* Browse area */}
      <div className="w-full border-2 border-dashed border-surface-4 rounded-lg p-4 flex flex-col items-center gap-2 text-center">
        <Upload size={20} className="text-text-muted" />
        <p className="text-xs text-text-secondary">
          {currentPath ? 'Browse to replace the current icon.' : 'Browse to select a local image file.'}<br />
          <span className="text-text-muted">PNG, SVG, JPG, ICO</span>
        </p>
        <button onClick={handleBrowse} disabled={busy}
          className="h-8 px-4 text-xs rounded-btn border border-surface-4 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base disabled:opacity-50">
          {busy ? 'Loading…' : 'Browse…'}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-surface-4" />
        <span className="text-[11px] text-text-muted uppercase tracking-wide">or paste URL / Base64</span>
        <div className="flex-1 h-px bg-surface-4" />
      </div>

      {/* Smart paste input — auto-expands to textarea when base64 is detected */}
      <div className="flex flex-col gap-1.5">
        {isExpanded ? (
          <textarea
            value={inputValue}
            onChange={e => handleInput(e.target.value)}
            rows={5}
            placeholder="data:image/png;base64,iVBORw0KGgo…"
            className="px-3 py-2 text-xs font-mono bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base resize-none"
          />
        ) : (
          <input
            value={inputValue}
            onChange={e => handleInput(e.target.value)}
            placeholder="https://example.com/icon.png or base64 string…"
            className="h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base"
          />
        )}
        {inputValue && (
          <span className="text-[11px] text-text-muted">
            {detected === 'url'    && (busy ? 'Fetching image…' : 'URL detected — fetching on pause')}
            {detected === 'base64' && 'Base64 image detected'}
            {detected === null     && 'Paste a full URL (https://…) or a base64 image string'}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-surface-4" />
        <span className="text-[11px] text-text-muted uppercase tracking-wide">or fetch favicon from site</span>
        <div className="flex-1 h-px bg-surface-4" />
      </div>

      {/* Favicon fetch section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={faviconUrl}
            onChange={e => { setFaviconUrl(e.target.value); setFaviconMsg(null) }}
            onKeyDown={e => e.key === 'Enter' && !faviconBusy && handleFaviconFetch()}
            placeholder="github.com"
            className="flex-1 h-8 px-3 text-xs bg-surface-3 rounded-input border border-surface-4
                       text-text-primary placeholder:text-text-muted outline-none
                       focus:border-accent transition-base duration-base"
          />
          <button
            onClick={handleFaviconFetch}
            disabled={faviconBusy || !faviconUrl.trim()}
            className="h-8 px-3 text-xs rounded-btn border border-surface-4
                       text-text-secondary hover:text-text-primary hover:bg-surface-3
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-base duration-base flex items-center gap-1.5 flex-shrink-0"
          >
            <RefreshCw size={11} className={faviconBusy ? 'animate-spin' : ''} />
            {faviconBusy ? 'Fetching…' : 'Fetch'}
          </button>
        </div>
        {faviconMsg && (
          <span className={`text-[11px] ${faviconMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {faviconMsg.text}
          </span>
        )}
        <span className="text-[10px] text-text-muted">
          Powered by favicon.vemetric.com · 64 × 64 PNG · saved locally
        </span>
      </div>

    </div>
  )
}

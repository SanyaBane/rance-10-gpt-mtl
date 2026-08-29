# Character genders, for pronouns

Who is which gender. One of the four tables CLAUDE.md says to consult before
writing an English proper noun, and the one `modules/CharacterGenders.js` reads:
it takes the Master Alphabetical List below and nothing else -- four columns,
keyed by the English name, which is the spelling 立ち絵名札マッピング情報 also uses,
so a portrait resolves through the plate table into a key this can answer.

Sources are the AliceSoft wiki's `Sex:` fields and VNDB across the twelve canon
games. Where those disagree with the game, the game wins: `8_カードデータ.x` carries
a 性別 column, and it is what settled Lassie.

**Spellings are not settled here.** `glossaries/mistranslated_names.json` is the
canonical table for those, and `glossaries/card_name_glossary.tsv` is the same for
anything appearing in a card Id. A name carried in two tables is a name with two
sources, so what belongs here is the gender -- and the notes below, which are the
cases where reading the text would get it wrong.

A name this list does not hold is the normal case rather than a fault: the cast is
far longer than the table, and `scripts/find_gender_gaps.js` is which speakers the
dialogue names that this does not answer.

---

## Special Cases

| Character | Note |
|---|---|
| **Uesugi Kenshin** | Historical male — **FEMALE** in Rance universe. Biggest GPT error source. |
| **Lexington** | Referred to as **MALE** throughout — use **he/him/his** — even though the entity wearing the name for much of the story is Nimitz, a female human impersonating him. This row used to ask for "Lord Lexington" as well, and the corpus answered with "Lady Lexington" 32 times against 12; the title is gone either way, because レキシントン様 is `Lexington-sama` now. See `docs/honorifics.md`. |
| **Kesselring** | **MALE** for the vast majority of the story. Use **he/him/his**; a sex change occurs late, but do not change pronouns unless you are certain the scene is post-change. This row used to ask for "Lord Kesselring" throughout — the dialogue picks no title at all now, and ケッセルリンク様 is `Kesselring-sama`, which is the one rendering that does not have to know which side of the change a scene is on. |
| **RedEye** | Genderless — avoid gendered pronouns |
| **Hanny** (generic) | Both sexes exist in the Hanny race |
| **Magic the Gandhi** | Name doesn't signal gender — **FEMALE**. マジック on its own is the loanword for "magic", the concept — only read it as this character where somebody is named or addressed. |
| **Gandhi** (the surname) | Three characters carry it and they are not one gender: Magic the Gandhi (Female), Sushinu the Gandhi (Female), Ragnarokarc Super Gandhi (Male). No sweep over the surname can be right for all three. |
| **Sanakia Drelshkaf** | Uses ボク pronoun in Japanese (tomboy) — **FEMALE** |
| **Babolat** | Looks like could be female — **MALE** |
| **Caesar** | Golem guardian, Roman name — **MALE** |
| **Juno** | Roman goddess name — **MALE** in Rance |
| **Pi-R** | Young-looking — **MALE** |
| **Lei** | Delinquent-type dark lord — **MALE** |
| **Galtia** | Friendly, food-loving dark lord — **MALE** |
| **Warg** | Harsh name — **FEMALE** |
| **Lassie** | Warg's "pet dog", and she calls him one, which is how this row read Female for a long time. **MALE**: the game's own `8_カードデータ.x` gives ラッシー 性別=1, and the wiki writes "He was originally just a mass of Souls" and "His physical structure". |
| **El Mofus** | **The player picks**, at ２部旅立ち: 選択_２択 between ルート：性別＝男 and ルート：性別＝女, kept as 主人公性別. There are an エール２男Ａ and an エール２女Ａ card for the same character. So El's 575 lines have to read either way — no he, no she, no "himself", and no "the young man". The player names El too, at the エール入力画面, which is why the dialogue writes ＜エール＞ rather than a name. |
| **Mi Lordring** | Bishop of AL Church — **MALE** |
| **Chochoman Publy** | Zeth Four Lord — **MALE** |
| **LeMay** | Monster Army General, named after historical figure — **MALE** (wiki confirmed). GPT may write "Lady LeMay"; this row used to say to fix that to "Lord LeMay", and where the Japanese says ルメイ様 the answer is `LeMay-sama` rather than either title. |
| **Kola** (Cola) | Male, but a big reveal at line ~21996 — use "Kola" or "the angel" before the reveal to avoid exposing gender. After reveal: he/him. |
| **Yutin Fulz** | Copandon's secretary — **Hermaphrodite** (wiki: "Sex Hermaphrodite"). Use they/them or avoid gendered pronouns. |
| **Amades Kakades** | User-confirmed **MALE**. |
| **Doss (Doessky)** | User-confirmed **MALE**. |
| **Samezan** | User-confirmed **FEMALE**. |

**ヴ is V and ビ is B.** ヴィッチ is a "Vitch", a word built on "witch"; ビッチ is
"bitch". One kana apart, naming different things, so the kana decides the
romanisation rather than the sound of the English.

---

## Master Alphabetical List

| Character | Japanese | Gender | Game(s) |
|---|---|---|---|
| 3G | 3G | Male | RX |
| Abert Safety | アベルト・セフティ | Male | RQ |
| Aegis Kalar | イージス・カラー | Female | RX |
| Agireda / Agireda Kosabusshi Zonna Abona | アギレダ | Female | RX |
| Aizel | アイゼル | Male | RVI |
| Akashi Kazemaru | 明石 風丸 | Male | SR |
| Akashiro Kalar | アカシロ | Female | RX |
| Aki Del | アキ・デル | Female | RVI |
| Alefgard | アレフガルド | Male | RX |
| Alex Valse | アレックス・ヴァルス | Male | RVI RX |
| Alexander | アレキサンダー | Male | RIII RX |
| Alfra Ray | アルフラ・レイ | Female | RQ |
| Alice | アリス | Female | RX |
| Alicia | アリシア | Female | RI R01 |
| Alkanese Rize | アルカネーゼ・ライズ | Female | RX |
| Am Yisael | アム・イスエル | Female | RX |
| Amades Kakades | アマデス・カカデス | Male | RX |
| Amitos Armitage | アミトス・アミテージ | Female | RX |
| Anasel Caspora | アナセル・カスポーラ | Female | RX |
| Andelmille | アンデルミィル | Female | RQ |
| Anise Sawatari | アニス・沢渡 | Female | RX |
| Anokia Moemoe Slin | アノキア・モエモエ・スリン | Female | RQ |
| Aoi | あおい | Female | RX |
| Apache | アパッチ | Male | RX |
| Apostle Alcarria / Alcarria | 使徒 アルカリア | Female | RX |
| Apostle Atlanta / Atlanta | 使徒 アトランタ | Female | RX |
| Apostle Aurora / Aurora | 使徒 オーロラ | Female | RX |
| Apostle Barbara / Barbara | 使徒 バーバラ | Female | RX |
| Apostle Elsill / Elsill | 使徒 エルシール | Female | RX |
| Apostle Garnet | 使徒 ガーネット | Female | RX |
| Apostle Gigai / Gigai | 使徒 戯骸 | Male | RX |
| Apostle Juno / Juno | 使徒 ジュノー | Male | RX |
| Apostle Kanayo / Kanayo | 使徒 加奈代 | Female | RX |
| Apostle Kaybnyan / Kaybnyan | ケイブニャン | Female | RX |
| Apostle Kaybwan / Kaybwan | ケイブワン | Female | RX |
| Apostle Lilim / Lilim | 使徒 リリム | Female | RX |
| Apostle Paleloa / Paleloa | 使徒 パレロア | Female | RX |
| Apostle Sapphire | 使徒 サファイア | Female | RX |
| Apostle Sharon / Sharon | 使徒 シャロン | Female | RX |
| Apostle Topaz | 使徒 トパーズ | Female | RX |
| Apostle Yuki / Yuki | 使徒 ユキ | Female | RX |
| Arcy Julietta | アーシー・ジュリエッタ | Female | RX |
| Arios Theoman | アリオス テオマン | Male | RQ RX |
| Aristoles Calm | アリストレス・カーム | Male | RQ |
| Arlcoate Marius | アールコート・マリウス | Female | RX |
| Arms Arc | アームズ・アーク | Female | RX |
| Asakura Yoshikage | 朝倉 義景 | Male | SR RX |
| Asakura Yuki | 朝倉 雪 | Male | SR |
| Asbestos | アスベスト | Male | RX |
| Asuka Cadmium | アスカ・カドミュウム | Female | RX |
| Atago McCart / Atago Macatt | アタゴ・マカット | Female | RX |
| Aten Gnu | アテン・ヌー | Female | RQ |
| Athena 2.0 / Mass-Produced Athena 2.0 | あてな2号 | Female | RX |
| Babolat | バボラ | Male | RVI RX |
| Bafamoon, King of the Naked Tribe | 裸族王バファムーン | Male | RX |
| Barres Province | バレス・プロヴァンス | Male | RIII RX |
| Bashou Matio |  | Male | SR |
| Battling Centers | バッティング・センターズ | Male | RX |
| Beast Tiger | 魔獣タイガー | Male | RX |
| Bernard Seramite | バーナード・セラミテ | Male | RX |
| Bezeleye | ベゼルアイ | Female | RX |
| Bintan Destra / Bintan Destora | ビンタン・デストラー | Male | RIII |
| Bird Lithfie | バード・リスフィ | Male | RQ RX |
| Biscuitta Berns / Biscuitta Burns | ビスケッタ・ベルンズ | Female | RX |
| Bitch Golch | ビッチ・ゴルチ | Male | RQ |
| Biyonhou Osman | ビヨンホウ | Male | RX |
| Black Lotus | ブラックロータス | Male | RX |
| Black Swan | ブラックスワン | Female | RIX |
| Bobza Flanders | ボブザ・フランダース | Male | RQ |
| Borchini | ボルチーニ | Male | RX |
| British | ブリティシュ | Male | RX |
| Caesar | シーザー | Male | RX |
| Cafe Artful | カフェ・アートフル | Female | RX |
| Caloria Cricket | カロリア・クリケット | Female | RX |
| Camilla | カミーラ | Female | RVI RX |
| Cantel | キャンテル | Male | RX |
| Captain | 船長 | Male | RX |
| Captain Vanilla | キャプテン バニラ | Female | SR |
| Carolie Mate / Calory Mate | キャロリ・メイト | Female | RX |
| Cecil Carna | セシル・カーナ | Female | RX |
| Cessna Benville | セスナ・ベンビール | Female | RQ |
| Cetina Favo | セティナ・ファーボ | Female | R5D |
| Chaka Cadmium |  | ? | RX |
| Chaos | カオス | Male | R01 RX |
| Chikuri | 乳久里 | Female | RX |
| Chisa Gode | チサ・ゴード | Female | RQ |
| Chizuko Yamada / Yamada Chizuko | 山田 千鶴子 | Female | RVI RX |
| Chochoman Publy | チョチョマン・パブリ | Male | RX |
| Colin Coccolin | コリン・コッコリン | Female | RQ |
| Convert Tax | コンバート・タックス | Male | RX |
| Copandon Dott | コパンドン・ドット | Female | RIV RX |
| Cordoba Burn | コルドバ・バーン | Male | RIII RX |
| Crane | クレイン | Female | RX |
| Cream Ganoblade | クリーム・ガノブレード | Female | RX |
| Crook Mofus | クルックー・モフス | Female | RX |
| Cu | クゥ | Female | RX |
| Cutie Band | キューティ・バンド | Female | SR |
| Cynthia | シンシア | Female | RIII |
| Daidouji Komatsu | 大道寺 小松 | Female | SR |
| Daniel Safety | ダニエル・セフティ | Male | RQ |
| Dark Alice | 闇アリス | Female | RX |
| Dark Rance | ダークランス | Male | RVI RQ RX |
| Dark Wings (Freya faction) | — | ? | RX |
| DD | 魔人ＤＤ | Male | RX |
| Demon King Little Princess | リトルプリンセス | Female | RX |
| Dens Blau | デンズ・ブラウ | Male | RQ |
| Dio Calmis | ディオ・カルミス | Male | RQ |
| Diphteria (city mayor) | ジフテリア | Male | RX |
| Dogi Magi | ドギ・マギ | Male | RX |
| Dokuganryuu Masamune | 独眼流 政宗 | Male | SR RX |
| Dolhan Cricket | ドルハン・クリケット | Male | RQ |
| Don Doessky | ドン・ドエススキー | Male | RX |
| Doss | ドッス | Male | RX |
| El Mofus | エール・モフス | Player's choice | RX |
| Eleanor Ran | エレノア・ラン | Female | RIII RX |
| Elena Flower | エレナ・フラワー | Female | RX |
| Elena L.R. | エレナ・エルアール | Female | RIV |
| Elizabeth Lacock | エリザベス・レイコック | Female | RQ |
| Emi Alphorne | エミ・アルフォーヌ | Female | RQ |
| Erina | エリナ | Female | SR |
| Eropicha Nyanko | エロピチャ・ニャンコ | Female | RX |
| Eroyack ALV | エロヤック | Male | RX |
| Ex Banquet | エクス・バンケット | Male | RX |
| Feliss | フェリス | Female | RVI RQ RX |
| Flame Scrivener | 使徒 火炎書士 | Female | RX |
| Fletcher Modell | フレッチャー・モーデル | Female | RQ |
| Foot Rot | フット・ロット | Male | R5D |
| Freak Paraffin | フリーク・パラフィン | Male | RQ |
| Freoncoise | フロンソワーズ | Female | RIII |
| Freya Idun | フレイア・イズン | Female | RX |
| Frostbyne | フロストバイン | Female | RX |
| Full Kalar | フル・カラー | Female | RX |
| Galban | ガルバン | Female | RX |
| Galtia | ガルティア | Male | RVI RX |
| Gazel Gode | ガイゼル・ゴード | Male | RQ |
| General Tiger | タイガー将軍 | Male | RX |
| Gengorou Shinoda / Shinoda Gengorou | 篠田源五郎 | Male | RX |
| Genri | 言裏 | Male | RVI |
| Giant Demonic Blood Soul | 巨大魔血魂 | Genderless | RX |
| Goddess ALICE | 女神アリス | Female | RX |
| Gon | ゴン | Male | SR |
| Haikara-chan | はいからちゃん | Female | RX |
| Haini Gold | ハイニ・ゴール | Female | RQ |
| Hanako | 花子 | Female | RX |
| Haniko | ハニ子 | Female | RX |
| Hanman | 大地の次世代魔物 | Male | RX |
| Hanny / Green Hanny / Blue Hanny / Red Hanny / Black Hanny | ハニー | Male | All |
| Hanny King | ハニー・キング | Male | RX |
| Hara Aki | 原 阿樹 | Female | SR |
| Hara Shouji | 原 昌示 | Female | SR |
| Haurein Province | ハウレーン・プロヴァンス | Female | RX |
| Hecate | ヘケート | Female | RQ RX |
| Hectomillibar Chizu | ヘクトミリバール・千津 | Female | RX |
| Heidi Pankrau | ハイジ・パンクラウ | Female | RX |
| Henderson Dauntless | ヘンダーソン・ドーントレス | Male | RQ |
| Hero Geimark | 勇者ゲイマルク | Male | RX |
| Hero Helman | ヒーロー２ | Male | RX |
| Hibachi | 火鉢 | Female | SR |
| Hikari Mi Blanc | ヒカリ・ミ・ブラン | Female | RQ |
| Ho Raga / Ho-Raga | ホ・ラガ | Male | RX |
| Holy Katana Nikkou / Nikkou | 聖刀日光 | Female | SR RX |
| Horikawa Nami | 堀川 奈美 | Female | SR |
| Hornet | ホーネット | Female | RVI RX |
| Horus | ノーマルホルス | Male | RX |
| Houjou Souun | 北条 早雲 | Male | SR RX |
| Houjou Susu |  | Female | RX (spoiler) |
| Houjou Suzu | すず２ | Female | RX |
| Housesnurse | ハウセスナース | Female | RX |
| Hubert Lipton | ヒューバート・リプトン | Male | RIII RIX RX |
| Hunty Kalar | ハンティ・カラー | Female | RQ RX |
| Ian Ruston | イアン | Male | RX |
| Ikanti Kalar | イカンティ | Female | RX |
| Imagawa Anko | 今川 あんこ | Female | SR |
| Imagawa Yoshimoto | 今川 義元 | Male | SR |
| Inukai | 犬飼 | Male | SR |
| Io Ishtar | イオ・イシュタル | Female | RIX RX |
| Isis | イシス | Male | RQ |
| Jaro Jaslak / Jaro Jasrack | ジャロ・ジャスラック | Male | R5D |
| Jean Gangvang II | ジャン・ギャンバン二世 | Male | RQ |
| Jericho Colon | イェリコ・コロン | Female | RQ |
| Jhahlckas | ジャハルッカス | Male | RX |
| Johnny | じょにぃ | Male | R5D |
| Joseph | 大将軍ヨシフ | Male | RX |
| Julia Lindum | ジュリア・リンダム | Female | RX |
| Kabachahn the Lightning | カバッハーン・ザ・ライトニング | Male | RX |
| Kalar | 汎用カラー | Female | RX |
| Kana Seihajuu Oosaka | カーナ・セイハジュウ・オオサカ | Female | SR |
| Kaoru Quincy Kagura | カオル・クインシー・神楽 | Female | RX |
| Kapalla Uche | カパーラ・ウーチ | Male | RQ |
| Karl Ojizan | カール・オジザン | Male | RQ |
| Karma Atranger | カーマ・アトランジャー | Female | RQ |
| Kasumi K. Kasumi | カスミ K. 香澄 | Female | RX |
| Katyusha Bosch | カチューシャ・ボッシュ | Female | RX |
| Kawanoe Mine | 川之江 美禰 | Female | SR |
| Kawanoe Yuzuru | 川之江 譲 | Male | SR |
| Kawazoe | かわぞえ | Male | RX |
| Kayblis (K-Chan) | ケイブリス | Male | RVI RX |
| KD | ＫＤ | Male | R02 RIV RVI RQ RX |
| Keiko | ケイコ | Female | RX |
| Keith Gold | キース・ゴールド | Male | RQ RX |
| Kentou Kanami | 見当 かなみ | Female | R01 RX |
| Kesselring | ケッセルリンク | Male→Female | RX (sex change) |
| Ketchuk Bangor | ケチャック・バンゴー | Male | RIII |
| Kiba-o | 命の次世代魔物 | Male | RX |
| Kibako | キバ子 | Female | RX |
| Kii | 紀伊 | Female | RX |
| Kikkawa Kiku | 吉川 きく | Female | SR RX |
| Kill Kill Takora | 力の次世代魔物 | Male | RX |
| Kimchi Drive | キムチ・ドライブ | Female | RX |
| King Dragon | キング・ドラゴン | Male | RQ |
| King Mantetsu | 満鉄王 | Male | RX |
| King Mitsubishi | 三菱王 | Male | RX |
| Kinggeorge Violae | キングジョージ・アバレー | Female | RQ |
| Kinkaid Brambla | キンケード・ブランブラ | Male | RX |
| Kiratouki | キラトーキ | Male | RX |
| Kisara Copley | キサラ・コプリ | Female | RQ |
| Kite | カイト | Male | RQ |
| Klean Bew | クリン・ビゥ | Female | RX |
| Kobayakawa Chinu | 小早川 ちぬ | Female | SR RX |
| Kojuurou | 小十郎 | Male | RX |
| Kola (Cola) | コーラ | Male | RX |
| Kousaka Yoshikage | 高坂 義風 | Male | SR |
| Koushuuin Hazuki | 甲州院 葉月 | Female | SR |
| Krutche Muffin | クルーチェ・マフィン | Female | RX |
| Kurobe | 黒部 | Male | SR RX |
| Kurohime | 黒姫 | Female | SR |
| Kurusu Miki | 来水 美樹 | Female | SR RX |
| La Hawzel | ラ・ハウゼル | Female | RX |
| La Seizel | ラ・サイゼル | Female | RX |
| La Vaswald | ラ・バスワルド | Female | RX |
| Lark Pikespeak | ラーク・パイクスピーク | Male | RQ |
| Lassie | ラッシー | Male | RX |
| Launea |  | ? | RX |
| Lei | レイ | Male | RX |
| Leila Grecni | レイラ・グレクニー | Female | R01 RX |
| Lelikov Helman | レリコフ・ヘルマン | Female | RX |
| Lelyukov Berkov | レリューコフ・バーコフ | Male | RIX |
| LeMay | ルメイ | Male | RX |
| Leopard Maara | レオパルド マーラ | Female | SR |
| Lexington |  | Male | RX |
| Lia Parapara Leazas | リア・パラパラ・リーザス | Female | R01 RX |
| Lil Avenger | 復讐ちゃん | Female | RQ |
| Locked Packet | 鍵付きパケット | Genderless | RX |
| Lola Indus | ローラ・インダス | Female | RQ |
| Louis Kittwac | ルイス・キートワック | Male | RIV |
| Lucy Julietta | ルーシー・ジュリエッタ | Female | RX |
| Magic the Gandhi | マジック・ザ・ガンジー | Female | RVI RX |
| Magisko | マジスコ | Female | RX |
| Mai | マイ | Female | SR |
| Maitrea Meishin | マイトレイア・メイシアン | Male | RIII |
| Makibano Meg | 牧場野 メグ | Female | SR |
| Makutsudou Nobuhiko | 魔窟堂 野武彦 | Male | SR |
| Maria Custard | マリア・カスタード | Female | RIII RX |
| Maris Amaryllis | マリス・アマリリス | Female | RX |
| Martina Curry | マルチナ・カレー | Female | RX |
| Mary Ann | メアリー・アン | Female | RX |
| Masou Shizuka / Shizuka Masou | 魔想 志津香 | Female | RIII RX |
| Masuzoe | ますぞゑ | Male | RX |
| Matilda Mateuri | マチルダ・マテウリ | Female | SR |
| Medusa | メディウサ | Female | RVI RX |
| Megadeath Moromi | メガデス・モロミ | Female | SR RX |
| Megaforce Horus | メガフォース・ホルス | Male | RX |
| Megas Horus | メガッス・ホルス | Male | RX |
| Megawas Horus | メガワス・ホルス | Male | RX |
| Mekill Depa L'Zile | ミーキル・デパ・ラジール | Female | RQ |
| Melfeis Promenade | メルフェイス・プロムナード | Female | RX |
| Menad Shisei | メナド・シセイ | Female | R01 RX |
| Mepora | めぽら | Female | RX |
| Merci Archa | メルシィ・アーチャ | Male | RQ |
| Mercy Julietta | マーシー・ジュリエッタ | Female | RX |
| Merim Tser | メリム・ツェール | Female | RX |
| Mi Lordring | ミ・ロードリング | Male | RX |
| Mighty-armed Rabble | 鉄腕ラブル | Female | RX |
| Mikan | ミカン | Female | RX |
| Mill Yorks / Milli Yorks | ミル・ヨークス | Female | RIII RX |
| Millie Lincle | ミリー・リンクル | Female | RQ |
| Mineva Margaret | ミネバ・マーガレット | Female | RIX RX |
| Miracle Tor | ミラクル・トー | Female | RX |
| Mix / Mix Tou | ミックス | Female | RX |
| Modern Kalar | モダン・カラー | Female | RX |
| Moganda | モガンダ | Male | RQ |
| Monster Captain Abashiri | 魔物隊長アバシリ | Male | RX |
| Morita Ai | 森田 愛 | Female | SR |
| Mouri Motonari | 毛利 元就 | Male | SR RX |
| Mouri Teru | 毛利 てる | Female | SR RX |
| Mud Princess Byranrose | 泥姫バイランローズ | Female | RX |
| Murala | ムララ | Male | RQ |
| Muscle | マッスル | Male | RX |
| Myiran | ミイラン | Female | RX |
| Mysteria Tor | ミステリア・トー | Female | RX |
| Nagata-kun | 長田君 | Male | RX |
| Nagi su Ragarl | ナギ・ス・ラガール | Female | RIII RX |
| Nanjou Ran | 南条 蘭 | Female | SR |
| Naoe Ai | 直江 愛 | Female | SR RX |
| Natori | 名取 | Female | SR |
| Nay Wrong | ネイ ヲロング | Female | RQ |
| Necai Sys | ネカイ・シス | Female | R5D |
| Needle | ニードル | Female | RX |
| Nelson Server | ネルソン・サーバー | Male | RX |
| Neplacus / Elder Neplacus | ネプラカス | Male | RX |
| Nero Chapet VII | ネロ・チャペット7世 | Male | RIII |
| Nikkou / Holy Katana Nikkou | 日光 | Female | SR RX |
| Nimitz Leak | ニミッツ リーク | Female | RX |
| Nina Nirvana | ニーナ | Female | RX |
| Noah Hakobune | ノア | Female | RIII RQ RX |
| Noah Sailing | ノア・セーリング | Female | RX |
| Nogiku | 野菊 | Female | SR RX |
| Noir | ノワール | Female | SR RX |
| Nook 77 | ヌーク７７ | Female | RX |
| Nopperabo |  | Female | SR |
| Nos | ノス | Male | RQ |
| Notongatsu | ノートンガツ | Genderless | RX |
| Nunuhara Cabbage | ヌヌハラ・キャベツ | Female | RX |
| Oama Motohide | オアマ・モトヒーデ | Male | SR |
| Oda Kou | 織田 香 | Female | SR RX |
| Oda Kouhime | 香姫 | Female | RX |
| Oda Nobunaga | 織田 信長 | Male | SR |
| Ogawa Kentarou | 小川 健太郎 | Male | SR RX |
| Ogier Lott Stein | オーギル・ロット・シュタイン | Male | RQ |
| Okita Nozomi | 沖田 のぞみ | Female | SR |
| Omachi | お町 | Female | SR RX |
| Onoha Mespos | オノハ・メスポス | Female | RX |
| Orime | 折女 | Female | SR RX |
| Oruore the 3rd | オルオレ・ザ・サード | Male | RX |
| Ouka Toki | 凰火 朱鷺 | Female | SR |
| Packet | パケット | Genderless | RX |
| Pamela Helman | パメラ・ヘルマン | Female | RIII RIX |
| Papaya Server | パパイア・サーバー | Female | RX |
| Papdimus Scirsabun (Papademas Shirusven) | — | Male | RX |
| Parsley Rig Zeth | パセリ・リグ・ゼス | Female | RX |
| Pastel Kalar | パステル・カラー | Female | RX |
| Patricia Bacon |  | Female | RX |
| Patton Misnarge / Patton Helman | パットン・ミスナルジ | Male | RIII RIX RX |
| Peruele Kalette | ペルエレ・カレット | Female | RX |
| Pervert Mouse | 変態ネズミ | Male | RQ |
| Pespo Tontone | ペスポ・トントーネ | Male | RX |
| Petrified Person | 石化した人 | Genderless | RX |
| Pi-R | パイアール | Male | RX |
| Pigu Geliciam | ピグ・ギリシアム | Female | RX |
| Pitten Chao | ピッテン・チャオ | Male | RX |
| Pizarro | ピサロ | Male | RX |
| Pluepet | プルーペット | Male | RX |
| Poron Chao | ポロン・チャオ | Male | RX |
| Potauf Tokrev | ポートフ・トカレフ | Male | RIX |
| Prima Hononoman | プリマ・ホノノマン | Female | RX |
| Prince Toshiba | 東芝王子 | Male | RX |
| Princess Hitachi | 日立姫 | Female | RX |
| Princess Panasonic | 松下姫 | Female | RX |
| Pulptenks Flanders | パルプテンクス・フランダース | Female | RQ |
| Quelplan | クエルプラン | Female | RX |
| Radon Alphorne | ラドン・アルフォーヌ | Male | RQ |
| Ragishss Cryhausen | ラギシス クライハウゼン | Male | RVI RX |
| Ragnarokarc Super Gandhi | ラグナロックアーク・スーパー・ガンジー | Male | RVI RX |
| Ralcat | ラルカット | Female | RX |
| Ralga Succubus | ラルガ・サッキュバス | Female | RQ |
| Rance / Demon King Rance | ランス | Male | All |
| Rance Castle Knight | 汎用ランス城騎士 | Female | RX |
| Rance Jr. | ランスＪｒ | Male | RX |
| Ranmaru | 乱丸 | Female | SR |
| Ratchet Luncheon | ラチェット・ランチョン | Male | RQ |
| Rebecca Copley | レベッカ・コプリ | Female | RQ |
| RedEye | レッドアイ | Genderless | RX |
| Reincock | ラインコック | Male | RQ |
| Replica Misly | レプリカ・ミスリー | Female | RQ |
| Reset Kalar | リセット・カラー | Female | RX |
| Return Demon | リターンデーモン | Male | RX |
| Richelle von do Kosusu | リクチェル・フォン・ド・コースス | Female | RX |
| Rick Addison | リック・アディスン | Male | R01 RX |
| Rizna Lanfbitt | リズナ・ランフビット | Female | RVI RX |
| Rocky Bank | ロッキー・バンク | Male | RX |
| Rodney Rodney | ロドネー・ロドネー | Male | RQ |
| Rolex Gadras | ロレックス・ガドラス | Male | RIII RIX RX |
| Rona Kestina | ロナ・ケスチナ | Female | RX |
| Root Ari |  | Female | RX |
| Rose Card | ロゼ・カド | Female | RQ |
| Rovert Landstar | ロバート・ランドスター | Male | RQ |
| Ruberan Tser | ルーベラン・ツェール | Female | RIX RX |
| Russian Kalette | ルシアン・カレット | Female | RIII |
| Sachiko Centers | サチコ・センターズ | Female | RX |
| Saias Crown | サイアス・クラウン | Male | RX |
| Sakamoto Ryouma | 坂本 龍馬 | Female | SR |
| Sakura Kalar | サクラ・カラー | Female | RX |
| Samar Happiness | サマール・ハッピネス | Male | RQ |
| Samezan |  | Female | RX |
| Samson Maximov | サムソン・マキシモフ | Male | RIX |
| Sanada Tourin | 真田 透琳 | Male | RX |
| Sanakia Drelshkaf | サーナキア・ドレルシュカフ | Female | RQ RX |
| Satella | サテラ | Female | RVI RX |
| Satellite Weapon | 衛星兵器 | Genderless | RX |
| Saya Friday | サヤ・フライディ | Female | RIII |
| Seigan | 性眼 | Male | SR |
| Sel Catchgolf | セル・カーチゴルフ | Female | RX |
| Senhime / Tokugawa Sen | 徳川千 | Female | SR RX |
| Sepia Landstarr | セピア・ランドスター | Male | RQ |
| Serachrolas | セラクロラス | Female | RX |
| Seyadatara | セヤダタラ | Female | RQ |
| Shachiko | シャチ子 | Female | RX |
| Shariela Aries / Shariela | シャリエラ・アリエス | Female | RX |
| Sheila Helman | シーラ・ヘルマン | Female | RIX RX |
| Shibata Katsuie | 柴田 勝家 | Male | SR |
| Shichisei | 七星 | Male | SR |
| Shimazu Yoshihisa | 島津 ヨシヒサ | Male | SR |
| Shizuka and Nagi | 子供志津香とナギ | Female | RX |
| Shuri Seihajuu Nagasaki | シュリ２ | Female | RX |
| Sieg | ジーク | Male | RVI |
| Silbarrel Silbarella | シルバレル・シルバレラ | Female | RX |
| Silky Littleraisin | シルキィ リトルレーズン | Female | RX |
| Sill Plain | シィル・プライン | Female | All |
| Sioux / Sioux Province | スー・プロヴァンス | Female | RX |
| Skeleton King Modokata | 骸骨王モドカタ | Male | RX |
| Sorutoan | ソルトアン | Female | RX |
| Squidman | イカマン | Male | R5D RVI SR RQ RIX RX |
| Starlevel The Great | スターレベル様 | Male | RQ |
| Stessel Romanov | ステッセル・ロマノフ | Male | RIX |
| Stroganoff | ストロガノフ | Male | RX |
| Sushinu the Gandhi | スシヌ・ザ・ガンジー | Female | RX |
| Suzume | 鈴女 | Female | RQ RX |
| System Goddess | システム神 | Female | RX |
| Tadanobu | 忠信 | Male | RX |
| Takeda Shingen | 武田 信玄 | Male | SR |
| Takega Satsu | 岳画 殺 | Female | SR |
| Tama | タマ | Female | RX |
| Tamagushi Fuuka | 玉籤 風華 | Female | SR |
| Tamanegi | タマネギ | Male | SR |
| Tanegashima Shigehiko | 種子島 重彦 | Male | SR |
| Tenmabashi Alice | 天満橋 ありす | Female | SR |
| Terra Horus | テラ | Female | RX |
| Thalgo |  | ? | RX |
| Thoma Lipton | トーマ・リプトン | Male | RIII RIX RX |
| Tilde Sharp | チルディ・シャープ | Female | RX |
| Tokugawa Ieyasu / Tokugawa Sen | 徳川 家康 | Male/Female | SR=Male; RX=Female (Sen) |
| Tolstoy Bato | トルストイ・バトー | Male | RIX |
| Tone / Tokugawa Tone | 深根 | Female | RX |
| Toppos | トッポス | Male | RX |
| Toushin Sigma | 闘神シグマ | Male | RX |
| Toushin Zeta | 闘神ゼータ | Male | RVI RX |
| Treasure Chest Dango | 宝箱だんご | Genderless | RX |
| Ueno Hanako | 上野花子 | Female | RX |
| Uesugi Katsuko | 上杉 勝子 | Female | SR RX |
| Uesugi Kenshin |  | Female | SR RX |
| Uesugi Torako | 上杉 虎子 | Female | SR RX |
| Unga Sayori | 運河 さより | Male | SR |
| Urza Pranaice | ウルザ・プラナアイス | Female | RVI RX |
| Uspira Shintou | ウスピラ・真冬 | Female | RX |
| Uzume / Kentou Uzume | ウズメ | Female | RX |
| Varen | ファーレン | Female | RX |
| Vital Fit | バイタル | Male | RX |
| Vivid Kalar | ビビッド・カラー | Female | RX |
| Warg | ワーグ | Female | RX |
| Wass | ワッス２ | Male | RX |
| Wayoso Benville | ワヨソ・ベンビール | Female | RQ |
| Wenlina | ウェンリーナー | Female | R42 RX |
| White Satan | 時の次世代魔物 | Male | RX |
| Wichita Skate | ウィチタ・スケート | Female | RX |
| Willis Fujisaki | ウィリス・藤崎 | Female | RX |
| Wrench Luncheon | レンチ・ランチョン | Female | RQ |
| Wuu | ウー | Male | SR |
| Xacalite | ザカリテ | Male | RX |
| Yamada Chizuko / Chizuko Yamada | 山田 千鶴子 | Female | RVI RX |
| Yamamoto Isoroku | 山本 五十六 | Female | SR RX |
| Yamamoto Rangi | 山本 乱義 | Male | RX |
| Yamanaka Kojika | 山中 子鹿 | Female | SR |
| Yamisagi / Dark Heron | 闇鷺 | Female | RX |
| YORA | ＹＯＲＡ | Male | RX |
| Yoshikawa Kyouko | 芳川 今日子 | Female | SR |
| Yoshikawa Machiko | 芳川 真知子 | Female | SR |
| Yosif | よーぜふ | Male | RX |
| Youko | 洋子 | Female | SR |
| Yuki Del | ユキ・デル | Female | RIV |
| Yukichi | 諭吉 | Male | RX |
| Yulang Mirage | ユラン・ミラージユ | Female | RQ |
| Yutin Fulz | ユーティン・フルズ | Hermaphrodite | RX |
| Yuzuhara Yuzumi | 柚原 柚美 | Female | SR RX |
| Yvette Cheria | イベット・チェリア | Female | RQ |
| Zance (Zans/Zence) / Zance Leazas | ザンス | Male | RX |
| Zedong | ツォトン | Male | RX |
| Zima Bakasko | ジーマ・バカスコ | Female | RQ |
| Zulki Crown | ズルキ・クラウン | Male | RX |

---

## Game Abbreviations
- R01 = Rance 01, R02 = Rance 02, RIII = Rance 03, RIV = Rance IV
- R41 = Rance 4.1, R42 = Rance 4.2, R5D = Rance 5D, RVI = Rance VI
- SR = Sengoku Rance, RQ = Rance Quest, RIX = Rance IX, RX = Rance X

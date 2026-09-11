# Shadow Beat

英語(イギリス英語)のシャドーイング × リズムゲーム。ネオン・ポップ系の見た目。

会話から抜き出した「強く読む単語(強勢語)」が拍に合わせて流れてきて、
そのタイミングでプレイヤーが声に出す。判定は**タイミングの正確さ**と
**声の強さ・メリハリ**の2軸で、発音の正誤(内容)は判定しない。

## 構成

- `app/src/main/assets/www/` — ゲーム本体(HTML/CSS/JS、WebViewで表示)
  - `data.js` — 各ステージの会話・強勢語・発音記号(IPA)データ
  - `game.js` — 拍の計算、マイクの音量からのスコア判定ロジック
  - `ui.js` — 画面遷移(タイトル→コース選択→ステージ選択→プレイ→結果)
- `app/src/main/java/com/shadowbeat/app/MainActivity.java` — Android側の橋渡し
  (WebView、マイク権限、英語TTS、AdMob広告)

## パッケージ名

`com.shadowbeat.app`(Play に一度出すと変更できません)

## 広告ID

`app/src/main/res/values/strings.xml` の3つのIDは、今はすべて
**Googleの公式テスト用ID**になっています。AdMobコンソールで本番の広告ユニットを
作成したら、公開前に必ず差し替えてください。

## ビルド方法

このリポジトリには GitHub Actions のワークフローが入っているので、PCがなくても
スマホから push するだけでビルドできます。

- `.github/workflows/android.yml` — pushのたびにデバッグAPKを自動ビルド。
  リポジトリの Secrets に署名鍵(`KEYSTORE_BASE64` など4つ)を登録すると、
  署名済みのリリース用AAB/APKも同時にビルドされます。
- `.github/workflows/make-keystore.yml` — 署名鍵を持っていない場合、
  Actionsタブから手動実行すると新しい鍵を作成できます(手順は
  FEELING THE WAY プロジェクトと同じです)。

ビルドが終わったら、Actionsタブの該当の実行 → Artifacts からAPK/AABを
ダウンロードできます。

## マイク・音声について

- マイクは**音量とタイミングの計測のみ**に使用し、録音・保存・送信は一切行いません
- 英語の読み上げは端末標準の音声合成(TTS, en-GB)を使用します
- 詳細は `docs/index.html`(プライバシーポリシー)を参照してください

## 未対応・今後の課題

- ステージ数は日常会話編・ビジネス編それぞれ6ステージ用意済み。追加は `data.js` に追記するだけ
- アプリアイコン・フィーチャーグラフィック・スクリーンショットは未作成(FEELING THE WAYの仮アイコンを流用中)
- 実機でのマイク判定の精度(しきい値のチューニング)は実際にプレイしながら調整が必要

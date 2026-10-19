# 後端建立步驟（Firebase）

狀態：本機已備妥入口、設定範本與規則。尚未建立或連接雲端專案；尚未部署規則、驗證登入或啟用雲端儲存。現有公開網站不受影響。

## 1. 由學校管理帳號建立專案

開啟 https://console.firebase.google.com/ ，用學校指定的管理 Google 帳號登入，新增專案。名稱可用 `tcsh-schedule`，專案 ID 必須依實際可用名稱決定。Google Analytics 並非本功能必要條件，可不啟用。若需要付費升級，先停止並確認用途與費用。

## 2. 新增 Web 應用程式

專案總覽新增 Web 應用程式（`</>`），名稱可用 `TCSH Schedule`。現有網站仍由 GitHub Pages 提供，不必勾選 Firebase Hosting。

取得 `firebaseConfig` 物件：通常包含 `apiKey`、`authDomain`、`projectId`、`storageBucket`、`messagingSenderId`、`appId`。將完整物件交由開發者填入 `js/firebase-config.js` 的 `window.FIREBASE_CONFIG`。

這是 Web 用戶端設定，不是管理憑證。不要提供 Google 密碼、登入驗證碼、OAuth client secret、服務帳戶 JSON 或私密金鑰。

## 3. 開啟 Google 登入

在 Authentication 的登入方式啟用 Google，選擇支援信箱。於 Settings / Authorized domains 加入：

`happytim31426-code.github.io`

只輸入網域，不加 `https://` 或 repository 路徑。若日後需本機測試，再另外加 `localhost`；登入功能不能直接以 `file:///` 測試。

## 4. 建立 Cloud Firestore

建立預設 `(default)` 資料庫，使用 Standard edition 及正式／鎖定模式，勿使用公開讀寫測試規則。選定區域前先確認資料所在地符合校方要求；建立後區域不可直接修改。

Rules 貼入本專案的 `firestore.rules` 並發布。未部署這份規則前，不能啟用網站登入後的資料操作。

## 5. 在 Firebase Console 建立第一位管理員

這一步由有專案管理權限的人在 Console 操作，不能由訪客網頁自行授予管理員。

集合：`members`

文件 ID：第一位管理員的完整 Google Email（與登入 Email 完全相同）。

欄位：

| 欄位 | 類型 | 值 |
| --- | --- | --- |
| name | string | 管理員姓名 |
| role | string | admin |
| active | boolean | true |

初始管理員由 Console 建立，不受用戶端規則欄位限制。登入接線完成後，用此帳號登入，再從網站權限管理新增其他授權者（role: teacher 或 admin）。管理員在網站不能停用／修改自己；必要時由另一位管理員或 Console 維護。

不要將實際人員 Email、角色名單寫進公開程式碼或提交到 GitHub。

## 6. 預定資料範圍與權限

- `members`：姓名、角色、啟用狀態、更新時間與操作者 UID。文件 ID 是 Google Email。使用者只可讀自己的授權；管理員可讀／維護完整名單。Google 驗證 Email 後才能查權限，且每次資料請求均由規則再驗證。
- `recruitmentPlans`：授權帳號自己的星期別安排草稿、更新時間與操作者 UID。未授權者不能讀寫。此階段不是按日期的歷史紀錄，同帳號同星期儲存會覆蓋草稿。未啟用。
- 每週代調課、照片與辨識資料：目前尚未開放，規則預設拒絕。後續實作需加日期、21 週學期設定、衝堂檢核、核准與修改紀錄。

注意：目前招生推薦由公開基本課表計算，前端登入入口能限制正常操作，但不能把既有公開課表衍生的結果變成機密。真正受資料庫權限保護的是名單與雲端安排；若要保護推薦演算法或其他非公開資料，還需將該部分移到後端，不能只隱藏網頁。

## 7. 啟用前驗證

實際專案建立、規則部署及接線完成後，至少驗證：未登入拒絕資料存取、非授權帳號拒絕讀寫、授權教師不能管理名單、管理員可授權／停用其他人、停用後不能再寫入、招生草稿可跨裝置讀回。Google 登入與 Firestore 規則未在實際專案或 Emulator 驗證前，不宣稱正式完成。

## 官方文件

- Google 登入：https://firebase.google.com/docs/auth/web/google-signin
- Firestore 存取規則：https://firebase.google.com/docs/firestore/security/rules-conditions
- Firebase Web 設定：https://firebase.google.com/docs/web/alt-setup

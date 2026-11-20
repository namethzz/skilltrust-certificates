# SkillTrust Academy · Digital Certificates

แบบฝึกหัดระบบออกและตรวจสอบใบรับรองดิจิทัลบน Ethereum Sepolia

| บทบาท | สิ่งที่ทำได้ |
| --- | --- |
| บุคคลทั่วไป | ค้นหาด้วยรหัสหรือสแกน QR ด้วยกล้องมือถือ แล้วเลือก PDF เพื่อเทียบ SHA-256 |
| ผู้เข้าอบรม | เชื่อม MetaMask เพื่อดูรายการใบรับรองของ Wallet |
| ผู้ออกใบรับรอง | ออกใบรับรองโดยระบุรหัสหลักสูตร Wallet ผู้รับ และ PDF ต้นฉบับ |
| ผู้ดูแล | ลงทะเบียนหลักสูตร ออกและเพิกถอนใบรับรอง และกำหนดสิทธิ์ผู้ออก |

Contract เก็บรหัสอ้างอิง เวลาออก เวลาเพิกถอน Wallet และ SHA-256 ของ PDF ส่วนชื่อผู้รับและไฟล์ PDF เก็บนอกเชน รหัสใบรับรองใช้ A–Z, 0–9 หรือขีดกลางและใช้ได้ครั้งเดียว แม้เพิกถอนแล้ว

## สมาชิกกลุ่มที่ 5

| รหัสนักศึกษา | ชื่อ–นามสกุล |
| --- | --- |
| 66057370 | สรัล นิธิสมบัติสกุล |
| 66085327 | ณเมธ วงค์มงคล |
| 66099903 | ธีรภัทร์ สายอุบล |

## Deploy ด้วย Remix + MetaMask

1. เปิด [Remix](https://remix.ethereum.org/) ในเบราว์เซอร์ที่ติดตั้ง MetaMask แล้วเพิ่มไฟล์ [SkillTrustCertificates.sol](./contracts/SkillTrustCertificates.sol) ใน File Explorer
2. ใน Solidity Compiler เลือก **0.8.34** และกด **Compile** เปิด Optimization ได้ที่ 200 runs
3. สลับ MetaMask เป็น **Sepolia** และตรวจยอด Sepolia ETH สำหรับค่าธรรมเนียมทดสอบ
4. ใน **Deploy & Run Transactions** เลือกสภาพแวดล้อมกระเป๋า **Browser Extension / MetaMask** แล้วกด **Deploy** โดย Value เป็น 0
5. ยืนยันใน MetaMask รอให้ธุรกรรมสำเร็จ แล้วคัดลอก Address จาก **Deployed Contracts** บัญชีที่ Deploy จะเป็นผู้ดูแล
6. ใส่ Address ที่ `address` ใน [config.js](./config.js) แล้ว commit ไปที่ `main`

[เอกสาร Deploy & Run ของ Remix](https://remix-ide.readthedocs.io/en/latest/run.html) · [Ethereum Testnets](https://ethereum.org/developers/docs/networks/)

## เปิด GitHub Pages

ที่ **Settings → Pages** เลือก **Deploy from a branch → main → /(root) → Save** รอให้ GitHub แสดง **Visit site** หน้าเว็บเป็นไฟล์ static และเปิดได้จากโฟลเดอร์ย่อยของ GitHub Pages

[เอกสาร GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## ทดสอบก่อนส่ง

1. เชื่อม MetaMask ด้วยบัญชีที่ Deploy แล้วสร้างหลักสูตร `CLOUD-101`
2. ออก `ST-2026-001` ให้ Wallet ผู้รับโดยใช้ PDF ตัวอย่างที่ไม่มีข้อมูลส่วนตัว
3. เปิดแท็บตรวจสอบ ค้นหารหัสและเลือก PDF เดิม ควรขึ้น **ยังมีผล** และ **ไฟล์ PDF ตรงกับแฮชบนเชน**
4. เลือก PDF อีกไฟล์และตรวจซ้ำ ควรแสดงผลว่าไฟล์ไม่ตรงกับแฮช ลองใช้กล้องมือถือสแกน QR ที่แสดงเพื่อเปิดลิงก์ค้นหา
5. เชื่อม Wallet ผู้รับในแท็บ **ใบรับรองของฉัน** และตรวจว่ามีรายการดังกล่าว
6. ใช้บัญชีผู้ดูแลเพิกถอน แล้วค้นหาซ้ำเพื่อดูสถานะ **เพิกถอนแล้ว** ประวัติของผู้รับควรยังมีรายการเดิม

ทดสอบหน้าจอในเครื่องด้วย `python -m http.server 8000` แล้วเปิด `http://localhost:8000` ในเบราว์เซอร์ ที่อยู่ Contract ที่ตั้งไว้ใช้ร่วมกันทั้งการอ่านข้อมูลและการส่งธุรกรรม

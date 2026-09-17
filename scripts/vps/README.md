# Chuyển database từ MongoDB Atlas sang MongoDB tự cài trên VPS

Hướng dẫn cho người làm lần đầu. Mọi lệnh bên dưới đã được **chạy thử trên
Ubuntu 24.04 trắng** (giống VPS mới thuê) ngày 2026-09-17, với MongoDB
8.0.32 — trùng phiên bản Atlas đang chạy.

Trong tài liệu:
- **Atlas** = database cũ (đang dùng).
- **VPS** = máy chủ mới, MongoDB tự cài.
- Lệnh bắt đầu bằng `sudo` chạy trên VPS qua SSH.

---

## Bước 0 — Chuẩn bị mật khẩu

Cần 3 mật khẩu cho MongoDB trên VPS (lưu vào trình quản lý mật khẩu):

| Tài khoản | Dùng cho | Quyền |
|---|---|---|
| `admin` | Bạn quản trị | Toàn quyền |
| `app` | Web đọc/ghi dữ liệu | Chỉ DB `listening_app` |
| `backup` | Sao lưu hằng đêm | Chỉ đọc để sao lưu |

Tạo mật khẩu ngẫu nhiên bằng lệnh sau (chạy 3 lần):

```bash
openssl rand -hex 24
```

> Dùng `-hex` chứ **không** dùng `-base64`: mật khẩu có ký tự `+ / =` sẽ làm
> hỏng chuỗi kết nối `mongodb://...` nếu quên mã hoá.

---

## Bước 1 — Cài MongoDB 8.0

```bash
sudo apt-get update && sudo apt-get install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

Kiểm tra:

```bash
mongod --version      # db version v8.0.x
mongosh --version
mongodump --version
```

Đặt giờ Việt Nam cho VPS (sao lưu/cron chạy đúng giờ):

```bash
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
```

---

## Bước 2 — Cấu hình

Chép file cấu hình mẫu trong repo vào VPS:

```bash
sudo cp scripts/vps/mongod.conf /etc/mongod.conf
sudo systemctl enable --now mongod
sudo systemctl status mongod        # phải thấy "active (running)"
```

File mẫu đã:
- chỉ nghe trong máy (`bindIp: 127.0.0.1`),
- **bắt buộc đăng nhập** (`authorization: enabled`),
- giới hạn RAM đệm 0,5 GB (VPS chạy chung web).

Sau này sửa `/etc/mongod.conf` thì chạy `sudo systemctl restart mongod`.
Nhật ký lỗi: `/var/log/mongodb/mongod.log`.

---

## Bước 3 — Tạo tài khoản

Khi chưa có tài khoản nào, MongoDB cho phép tạo **tài khoản đầu tiên** từ
chính máy VPS. Mở `mongosh`:

```bash
mongosh
```

Dán vào (sẽ hỏi mật khẩu — dán mật khẩu `admin` ở Bước 0):

```js
db.getSiblingDB("admin").createUser({ user: "admin", pwd: passwordPrompt(), roles: ["root"] })
exit
```

Đăng nhập lại bằng `admin` rồi tạo 2 tài khoản còn lại:

```bash
mongosh -u admin -p --authenticationDatabase admin
```

```js
const a = db.getSiblingDB("admin")
a.createUser({ user: "app", pwd: passwordPrompt(), roles: [{ role: "readWrite", db: "listening_app" }] })
a.createUser({ user: "backup", pwd: passwordPrompt(), roles: ["backup"] })
exit
```

Kiểm tra: vào **không** mật khẩu phải bị từ chối:

```bash
mongosh --quiet --eval 'db.getSiblingDB("listening_app").users.findOne()'
# -> MongoServerError: Command find requires authentication   (đúng)
```

---

## Bước 4 — Tường lửa

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ss -ltnp | grep 27017      # phải là 127.0.0.1:27017, KHÔNG phải 0.0.0.0
```

**Không** mở cổng 27017.

---

## Bước 5 — Chuyển dữ liệu (ngày chuyển)

Dữ liệu hiện chỉ vài MB, cả bước này mất khoảng **5 phút**.

### 5.1 Trước ngày chuyển
- Web mới đã cài trên VPS và chạy thử được với MongoDB trên VPS (phần đưa
  web lên VPS — Node, PM2, Nginx, HTTPS — không nằm trong tài liệu này).
- Trong Atlas → **Network Access**: thêm **IP của VPS** để VPS đọc được Atlas.

### 5.2 Đóng băng dữ liệu cũ
Chọn giờ vắng (tối muộn), báo trước cho giáo viên/học sinh. Bất cứ gì được
ghi vào Atlas **sau** bước sao chép sẽ không sang VPS.

Muốn chắc chắn không ai ghi thêm: trong Atlas → Network Access, **xoá các
dòng cho phép khác, chỉ để lại IP VPS** — web cũ sẽ ngừng kết nối được DB.
(Thêm lại là web cũ chạy tiếp.)

### 5.3 Sao chép

Trên VPS, dán chuỗi kết nối Atlas **live** (biến `MONGODB_URI_LIVE`, dạng
`mongodb+srv://.../listening_app?...`). Lệnh `read -s` không hiện và không
lưu nó vào lịch sử:

```bash
mkdir -p ~/migrate && cd ~/migrate
read -rsp "Chuoi ket noi Atlas: " ATLAS_URI; echo
mongodump --uri="$ATLAS_URI" --archive=atlas-live.archive.gz --gzip
```

`mongodump` **chỉ đọc** Atlas — không thay đổi gì bên đó. File
`atlas-live.archive.gz` cũng chính là **bản sao lưu cuối cùng** của Atlas,
hãy giữ lại.

Nạp vào MongoDB trên VPS:

```bash
read -rsp "Mat khau admin MongoDB (VPS): " MPASS; echo
mongorestore --uri="mongodb://admin:$MPASS@127.0.0.1:27017/?authSource=admin" \
  --archive=atlas-live.archive.gz --gzip --drop
# cuối cùng phải thấy: "N document(s) restored successfully. 0 document(s) failed"
```

`--drop` chỉ xoá bảng **trên VPS** trước khi nạp, nên chạy lại bao nhiêu lần
cũng an toàn.

### 5.4 Đối chiếu

Trong thư mục code của web trên VPS (đã `npm ci`):

```bash
read -rsp "Mat khau app MongoDB (VPS): " APP_PASS; echo
node scripts/verify-db-copy.js "$ATLAS_URI" \
  "mongodb://app:$APP_PASS@127.0.0.1:27017/listening_app?authSource=admin"
```

Phải thấy **`Khop hoan toan.`** — từng bảng cùng số bản ghi và đủ index (kể
cả index tự xoá). Nếu có dòng `LECH`: chạy lại lệnh `mongorestore` ở 5.3 rồi
đối chiếu lại. Script chỉ đọc, không ghi gì.

### 5.5 Chuyển web sang DB mới

Trong file env của web trên VPS, đổi:

```
MONGODB_URI=mongodb://app:MAT_KHAU_APP@127.0.0.1:27017/listening_app?authSource=admin
```

Khởi động lại web, đăng nhập thử (giáo viên, học sinh, admin), mở vài bài
nộp, nộp thử 1 bài. Ổn rồi mới trỏ tên miền về VPS.

### 5.6 Giữ Atlas làm dự phòng
**Đừng xoá cụm Atlas ngay**, giữ vài tuần. Lưu ý: nếu quay lại Atlas sau khi
web mới đã chạy, dữ liệu phát sinh trên VPS sẽ không có bên Atlas.

---

## Bước 6 — Sao lưu tự động hằng đêm

```bash
sudo cp scripts/vps/backup-mongo.sh /usr/local/bin/backup-mongo.sh
sudo chmod +x /usr/local/bin/backup-mongo.sh
sudo nano /etc/mongo-backup.env
```

Nội dung `/etc/mongo-backup.env`:

```bash
BACKUP_URI="mongodb://backup:MAT_KHAU_BACKUP@127.0.0.1:27017/?authSource=admin"
DB_NAME="listening_app"
KEEP_DAYS="14"
# RCLONE_REMOTE="gdrive:mongo-backups"   # bật khi đã cài rclone (xem dưới)
```

```bash
sudo chmod 600 /etc/mongo-backup.env
sudo /usr/local/bin/backup-mongo.sh        # chạy thử: "backup ok: ..."
sudo crontab -e
```

Thêm dòng (2h30 sáng mỗi ngày):

```
30 2 * * * /usr/local/bin/backup-mongo.sh >> /var/log/mongo-backup.log 2>&1
```

Script tự xoá bản cũ hơn 14 ngày, và báo lỗi (ghi vào
`/var/log/mongo-backup.log`) nếu sai mật khẩu hoặc file hỏng.

### Đưa bản sao lưu ra khỏi VPS (nên làm)
VPS hỏng mà bản sao lưu cũng nằm trên VPS thì mất hết. Cách đơn giản: cài
[rclone](https://rclone.org/drive/), cấu hình 1 "remote" tới Google Drive,
rồi bật dòng `RCLONE_REMOTE` ở trên. *(Phần rclone chưa được chạy thử trong
buổi kiểm tra — làm theo tài liệu của rclone.)*

### Khôi phục thử — mỗi tháng 1 lần
Bản sao lưu chưa từng khôi phục thử thì chưa chắc dùng được. Khôi phục vào
một DB **tạm** (không đụng dữ liệu thật), kiểm tra rồi xoá:

```bash
read -rsp "Mat khau admin MongoDB (VPS): " MPASS; echo
F=$(ls -t /var/backups/mongo/listening_app-*.archive.gz | head -1)
mongorestore --uri="mongodb://admin:$MPASS@127.0.0.1:27017/?authSource=admin" \
  --archive="$F" --gzip --nsFrom="listening_app.*" --nsTo="restore_test.*"
mongosh -u admin -p --authenticationDatabase admin --eval '
  const b = db.getSiblingDB("restore_test");
  print("students:", b.students.countDocuments(), "submissions:", b.submissions.countDocuments());
  b.dropDatabase();'
```

---

## Khi cần khôi phục thật

```bash
read -rsp "Mat khau admin MongoDB (VPS): " MPASS; echo
mongorestore --uri="mongodb://admin:$MPASS@127.0.0.1:27017/?authSource=admin" \
  --archive=/var/backups/mongo/listening_app-YYYY-MM-DD-HHMM.archive.gz --gzip --drop
```

`--drop` **xoá dữ liệu hiện tại** của các bảng trước khi nạp bản sao lưu —
chỉ chạy khi chắc chắn muốn quay về thời điểm đó.

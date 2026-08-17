| Method | Path | Auth Gerekli mi | Test Edilen Senaryolar | Başarısız Olanlar | Not |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/uploads/<path:filename>` | Hayır | a, c, d, e, f | Yok | HTTP 404 (Schema OK, Content-Type: text/html) |
| `POST` | `/api/upload` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/` | Hayır | a, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: text/html) |
| `POST, OPTIONS` | `/api/login` | Hayır | a, c, d, e, f | Yok | HTTP 401 (Schema OK, Content-Type: application/json) |
| `POST, OPTIONS` | `/api/auth/login` | Hayır | a, c, d, e, f | Yok | HTTP 401 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/students` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/students/<int:student_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/students/<int:student_id>/reset-password` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `PUT` | `/api/students/<int:student_id>/account` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/admin/students/<int:student_id>/change-coach` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/coaches` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/coaches/<int:coach_id>/reset-password` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `PUT` | `/api/coaches/<int:coach_id>/account` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/admin/users` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/profile/change-password` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/auth/me` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/koc/dashboard` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/student/dashboard` | Evet | a, b, c, d, e, f | Yok | HTTP 403 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/simulasyon/puan-hesapla` | Hayır | a, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/excel/import` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/deneme` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `DELETE` | `/api/deneme/<int:attempt_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/deneme/compare` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/deneme/action` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/deneme/topic-results` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/subjects` | Hayır | a, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/subjects` | Hayır | a, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/topics` | Hayır | a, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `DELETE` | `/api/deneme/topic-results/<int:result_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/deneme/analiz` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/soru-takibi` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST, DELETE` | `/api/haftalik-program` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/haftalik-program/item-status` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST, PUT, DELETE` | `/api/odevler` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/timer` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/kaynaklar` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `PUT, DELETE` | `/api/kaynaklar/<int:resource_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/kaynaklar/kesif` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynaklar/kesif/auto-discover` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `DELETE` | `/api/kaynaklar/kesif/<int:queue_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/kaynaklar/student` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/kaynaklar/ogrenci` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynaklar/assign` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynaklar/student` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `DELETE` | `/api/kaynaklar/student-resource/<int:student_resource_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynaklar/bulk-assign` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/mufredat` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/mufredat/kaynak-ata` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/mufredat/konu-durum-guncelle` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/mufredat/durum-guncelle` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/mufredat/kaynak-degistir` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `DELETE` | `/api/mufredat/kaynak-sil/<int:topic_resource_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/kaynaklar/havuz` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynaklar` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynaklar/create-and-assign` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/weekly-program` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/weekly-program` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `PUT` | `/api/weekly-program/<int:prog_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 404 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/weekly-program/publish` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/weekly-program/clear` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/weekly-program/copy` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `DELETE` | `/api/weekly-program/<int:prog_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 404 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/weekly-program/<int:prog_id>/status` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/admin/dashboard` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/admin/activity-logs` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/student/update-field` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/kaynaklar/<int:student_resource_id>/mufredat-ilerleme` | Evet | a, b, c, d, e, f | Yok | HTTP 404 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynaklar/<int:student_resource_id>/konu-durumu` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/mufredat/konu-detay` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/kitaplar` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/mesajlar/contacts` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/mesajlar/unread-summary` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/mesajlar` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/mesajlar/<int:message_id>/pin` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `DELETE, PUT` | `/api/mesajlar/<int:message_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/mesajlar/settings` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/mesajlar/broadcast` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/raporlar/pdf` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/pdf) |
| `GET` | `/api/excel/export` | Hayır | a, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet) |
| `GET` | `/api/raporlar` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/admin/clear-demo-data` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/ai/analyze-student` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/rel/students` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/rel/my-coaches` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/rel/admin-assign` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/rel/invite` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/rel/invite/<token>` | Hayır | a, c, d, e, f | Yok | HTTP 404 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/rel/invite/<token>/respond` | Evet | a, b, c, d, e, f | Yok | HTTP 403 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/rel/coach-code` | Evet | a, b, c, d, e, f | Yok | HTTP 403 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/rel/coaches-search` | Hayır | a, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/rel/requests/<int:req_id>/respond` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/rel/coach-notes` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/kaynak-havuzu` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `PUT, DELETE` | `/api/kaynak-havuzu/<int:resource_id>` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, POST` | `/api/kaynak-havuzu/<int:resource_id>/topics` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynak-havuzu/<int:resource_id>/assign` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/kaynak-havuzu/student-assignments` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynak-havuzu/topic-progress` | Evet | a, b, c, d, e, f | Yok | HTTP 400 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/kaynak-havuzu/<int:resource_id>/copy-to-my-pool` | Evet | a, b, c, d, e, f | Yok | HTTP 403 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/notifications` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/notifications/<int:notif_id>/read` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `POST` | `/api/notifications/read-all` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET` | `/api/activity-logs` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |
| `GET, PUT` | `/api/notification-preferences` | Evet | a, b, c, d, e, f | Yok | HTTP 200 (Schema OK, Content-Type: application/json) |

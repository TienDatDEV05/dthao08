# Antigravity Workspace Guidelines & Workflows

Dự án này sử dụng hệ thống **Workflows** và **Skills** chuyên sâu để hỗ trợ phát triển và duy trì codebase.

---

## ⚡ Các lệnh Slash Command (`/`) sẵn có

Bạn có thể gõ trực tiếp dấu `/` trong khung chat để chọn và kích hoạt:

| Lệnh Slash | File hướng dẫn | Mục đích |
|---|---|---|
| `/plan` | `.agents/workflows/plan.md` | Quy trình thực thi task 3 pha: **Brainstorm → Execute → Save Learnings** |
| `/brainstorming` | `.agents/workflows/brainstorming.md` | Chuyển đổi ý tưởng thành thiết kế qua hỏi đáp có kỷ luật trước khi code |
| `/code-reviewer` | `.agents/workflows/code-reviewer.md` | Chuyên gia review code, tối ưu chất lượng, hiệu năng và bảo mật |
| `/find-bugs` | `.agents/workflows/find-bugs.md` | Rà soát lỗ hổng bảo mật, bug tiềm ẩn và edge cases trên code |
| `/ai-learning` | `.agents/workflows/ai-learning.md` | Trích xuất kiến thức (Architecture, Bugs, How-To, Patterns) vào `.agents/learnings/` |
| `/human-learning` | `.agents/workflows/human-learning.md` | Tạo file giải thích "coffee talk" thân mật cho developer review lại toàn bộ task |

---

## 🛠️ Các Skills tương ứng

| Skill | Đường dẫn | Mục đích |
|---|---|---|
| `plan` | `.agents/skills/plan/SKILL.md` | Kỹ năng lập kế hoạch và thực thi task theo chuẩn 3 pha |
| `brainstorming` | `.agents/skills/brainstorming/SKILL.md` | Chuyển đổi ý tưởng thành thiết kế qua hỏi đáp có kỷ luật trước khi code |
| `code-reviewer` | `.agents/skills/code-reviewer/SKILL.md` | Chuyên gia review code, tối ưu chất lượng, hiệu năng và bảo mật |
| `find-bugs` | `.agents/skills/find-bugs/SKILL.md` | Rà soát lỗ hổng bảo mật, bug tiềm ẩn và edge cases trên code vừa sửa |
| `ai-learning` | `.agents/skills/ai-learning/SKILL.md` | Kỹ năng tự động hóa ghi nhớ kiến thức cho AI |
| `human-learning` | `.agents/skills/human-learning/SKILL.md` | Kỹ năng đúc kết bài học thực tế cho lập trình viên |

---

## 📁 Thư mục lưu trữ kiến thức (Learnings)
- `.agents/learnings/` : Chứa các file đúc kết kỹ thuật theo feature.
- `.agents/learnings/human/` : Chứa các bài học kinh nghiệm và giải thích chi tiết cho Developer.

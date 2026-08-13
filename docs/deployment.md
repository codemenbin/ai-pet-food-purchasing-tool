# Vercel 部署手册

> 详细部署步骤、环境变量清单、故障排查。所有路径默认使用 GitHub 集成方式，vercel CLI 单列。

## 一、部署前清单

在动手之前确认以下 5 项：

1. **API Key 已轮换**——在 MiniMax 控制台 revoke 旧 Key + 重新签发新 Key
2. **新 Key 已粘贴到剪贴板**——不要通过对话 / 截图 / 终端历史传输
3. **本地代码已提交到 Git**——`git status` 干净
4. **本地 `pnpm run verify` 全绿**——避免推上去才发现构建失败
5. **Vercel 账号已注册**——[vercel.com](https://vercel.com) 免费 tier 够用

## 二、环境变量清单

### Production（生产环境，给面试官访问）

| 变量 | 值 | 说明 |
|---|---|---|
| `DEMO_MODE` | `0` | 关闭演示模式 |
| `LLM_MOCK` | `0` | 关闭 mock LLM |
| `LLM_BASE_URL` | `https://api.minimax.chat/v1` | MiniMax OpenAI 兼容 endpoint |
| `LLM_API_KEY` | `<轮换后的新 Key>` | **仅在 Vercel 控制台填入** |
| `LLM_MODEL` | `MiniMax-M3` | 模型名 |

### Preview / Development（预览构建）

建议全部留 `DEMO_MODE=1` 默认值。这样：

- 每次 PR 触发的预览构建不会消耗真实 Key 额度
- 即使 Preview URL 被泄露，攻击者看到的也只是 mock 数据
- 调试 LLM 相关 bug 时可临时改成 `DEMO_MODE=0` 验证

## 三、GitHub 集成路径（推荐）

### 3.1 推代码到 GitHub

```bash
# 新建 GitHub 仓库（建议私有），然后：
git remote add origin git@github.com:<your-name>/ai-pet-food-purchasing-tool.git
git branch -M main
git push -u origin main
```

### 3.2 在 Vercel 导入

1. 登录 [vercel.com](https://vercel.com)
2. 点 Add New Project → Import Git Repository
3. 选 `ai-pet-food-purchasing-tool` → Import
4. Framework Preset 自动识别为 Next.js
5. **先不要点 Deploy**！先设置环境变量

### 3.3 设置环境变量

1. 在 Project Settings → Environment Variables
2. 对每个 Production 变量点 Add New：
   - Name: `LLM_API_KEY`
   - Value: 粘贴新 Key
   - Environment: 勾 Production
3. 重复上述步骤，添加另外 4 个 Production 变量
4. （可选）Preview 环境单独加一组 `DEMO_MODE=1 LLM_MOCK=1`

### 3.4 部署

1. 回到 Deployments 页 → Deploy
2. 构建日志会显示 `pnpm install --frozen-lockfile` + `pnpm build`
3. 约 90 秒完成，得到 `https://ai-pet-food-purchasing-tool.vercel.app`

## 四、vercel CLI 路径（一次性）

### 4.1 安装

```powershell
# PowerShell 需先调整执行策略
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

npm i -g vercel
```

### 4.2 登录 & 关联

```bash
cd ai-pet-food-purchasing-tool
vercel login                  # 弹浏览器授权
vercel link                   # 首次会让你输入 project name（建议 ai-pet-food-purchasing-tool）
```

### 4.3 交互式添加环境变量

```bash
vercel env add LLM_API_KEY production    # 粘贴新 Key
vercel env add LLM_BASE_URL production
vercel env add LLM_MODEL production
vercel env add DEMO_MODE production
vercel env add LLM_MOCK production

# 列出已添加的变量确认
vercel env ls
```

### 4.4 部署

```bash
vercel --prod
```

输出会包含 Production URL，复制下来发个面试官即可。

## 五、部署后验收

### 5.1 浏览器实测

| 操作 | 期望结果 |
|---|---|
| 访问 `/` | 首页加载，两个入口卡片可见 |
| `/recommend` 默认值提交 | 推荐列表渲染（应该有 3-5 张卡片） |
| `/recommend` 物种改「狗」 | 推荐列表全部是狗粮（验证物种预过滤） |
| `/recommend` 月龄改 120 | 阶段下拉联动到「老年」；推荐结果偏向高龄宠物粮 |
| `/compare` 多选 2-3 款 | 对比表渲染 + 适配度评分 + 裁决文字 |
| 浏览器 DevTools → Network | `/api/recommend` 响应 JSON 含 `source: "llm"`（不是 mock/rule） |

### 5.2 Vercel Function Logs

Vercel 控制台 → Project → Logs → Functions：

- 应看到 `POST /api/recommend` 200，duration < 5s（首次冷启动可能 1-3s）
- 应看到 `POST /api/compare` 200
- 不应有任何 500 错误
- LLM 调用若失败，应自动回退到 rule-based（response `source: "rule"`）

### 5.3 冷启动说明

Vercel Function 闲置一段时间后会被冻结，首次访问触发冷启动 1-3 秒。这是 serverless 平台正常行为，不影响功能。如面试官反馈慢，可提前点开链接预热。

## 六、回滚

### Vercel 控制台

Deployments → 选历史版本 → Promote to Production

### vercel CLI

```bash
vercel ls                     # 查看历史
vercel rollback               # 回滚到上一个
```

## 七、域名

### 默认子域名

Vercel 会自动分配 `https://ai-pet-food-purchasing-tool.vercel.app`。可在 Settings → Domains 改成更友好的（如 `pet-food-demo.vercel.app`）。

### 自定义域名

1. 买域名（阿里云 / 腾讯云 / Cloudflare Registrar 都行）
2. Vercel → Settings → Domains → Add
3. 按提示在 DNS 添加 CNAME 记录
4. Vercel 自动签发 HTTPS 证书

## 八、Key 轮换（部署后 / 定期）

无论部署期间是否泄露，**都建议轮换**：

1. MiniMax 控制台 → API Keys → Revoke 旧 Key
2. Create New Key（建议一次性 / 受额度 / 带过期）
3. Vercel → Settings → Environment Variables → 改 `LLM_API_KEY` 值 → Save
4. Deployments → Redeploy
5. 验证推荐 / 对比功能仍正常

## 九、故障排查

### Q: 构建失败 `pnpm install --frozen-lockfile`

A: pnpm-lock.yaml 与 package.json 不一致。本地跑 `pnpm install` 重新生成 lock，重推。

### Q: 部署成功但 `/recommend` 返回空数组

A: 大概率是 LLM 调用失败回退到 rule-based，且 rule-based 也没匹配。检查 Vercel Function Logs 找具体错误。

### Q: 冷启动超过 10 秒

A: 偶发问题，重试一次。或在 vercel.json 加 `"functions": { "src/app/api/**/*.ts": { "maxDuration": 30 } }` 延长时间。

### Q: 推荐结果全是 mock 风格（不是真实 LLM）

A: `DEMO_MODE` 或 `LLM_MOCK` 没设为 `0`。检查 Vercel Environment Variables 并 Redeploy。

### Q: Key 误提交到仓库

A: 立即在 MiniMax 控制台 Revoke。然后 `git filter-repo` 或 BFG 清理历史，强制推送到所有 fork。

## 十、安全自检清单（部署前后各跑一次）

```bash
# 1. 仓库无 Key 泄露
git grep -E "sk-[a-zA-Z0-9_-]{20,}"  # 应该空

# 2. .env 不在工作树
cat .env | grep "replace-with"        # 应该是占位符

# 3. .vercelignore 覆盖关键文件
cat .vercelignore

# 4. 本地门禁全绿
pnpm run verify
```

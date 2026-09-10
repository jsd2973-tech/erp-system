from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace('import { supabase } from "./supabaseClient";', 'import { isSupabaseTestMode, supabase } from "./supabaseClient";', 1)
old = '  const adminEmails = ["jsd2973@gmail.com"];\n  const userEmail = session?.user?.email || "";\n  const isAdmin = adminEmails.includes(userEmail);'
new = '  const testAdminEmail = isSupabaseTestMode ? String(import.meta.env.VITE_TEST_ADMIN_EMAIL || "").trim().toLowerCase() : "";\n  const adminEmails = ["jsd2973@gmail.com", ...(testAdminEmail ? [testAdminEmail] : [])];\n  const userEmail = session?.user?.email || "";\n  const isAdmin = adminEmails.includes(userEmail.toLowerCase());'
if old not in text:
    raise SystemExit('admin email target not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

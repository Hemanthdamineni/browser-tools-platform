import pathlib
p = pathlib.Path('src/tools/security/known-hosts-inspector.tool.ts')
s = p.read_text()
old = "  let notes: string[] = [];\n  let warnings: string[] = [];\n"
assert s.count(old) == 1, s.count(old)
s = s.replace(old, "  let notes: string[] = [];\n", 1)
p.write_text(s)
print("removed duplicate warnings decl")

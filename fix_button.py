file = "src/pages/warehouses/WarehouseDetailPage.tsx"
lines = open(file, encoding="utf-8").readlines()
# line 160 is index 159 (0-based)
# Find the line with just "          >" after onClick line
for i, line in enumerate(lines):
    if 'onClick={() => navigate(\'/warehouses\')}' in line:
        # Next line should be "          >"
        lines[i+1] = "            <ArrowLeft className=\"w-4 h-4\" />\n"
        break
open(file, "w", encoding="utf-8").writelines(lines)
print("done")

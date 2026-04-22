import os
import re

files_to_update = [
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\pages\StudioPage.tsx",
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\components\AgentCard.tsx"
]

replacements = [
    (r"background:\s*'rgba\(28,26,23,0\.8\)'", r"background: 'rgba(255,255,255,0.95)'"),
    (r"background:\s*'rgba\(90,85,80,0\.8\)'", r"background: 'rgba(255,255,255,0.6)'"),
    (r"background:\s*'rgba\(2,8,23,0\.5\)'", r"background: 'rgba(255,255,255,0.6)'"),
    (r"background:\s*'rgba\(2,8,23,0\.7\)'", r"background: 'rgba(255,255,255,0.95)'"),
    
    # Specific step backgrounds
    (r"background:\s*'rgba\(59,130,246,0\.06\)'", r"background: 'rgba(255,255,255,0.8)'"),
    (r"background:\s*'rgba\(245,158,11,0\.06\)'", r"background: 'rgba(255,255,255,0.8)'"),
    (r"background:\s*'rgba\(16,185,129,0\.06\)'", r"background: 'rgba(255,255,255,0.8)'"),
    (r"background:\s*'rgba\(244,63,94,0\.06\)'", r"background: 'rgba(255,255,255,0.8)'"),
    
    # Fix the agent card inner backgrounds if any remain
    (r"bg-white/5", r"bg-white"),
    (r"border-white/10", r"border-[#b4a08c]/20"),
]

for filepath in files_to_update:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for pattern, repl in replacements:
        content = re.sub(pattern, repl, content)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("StudioPage dark colors fixed!")

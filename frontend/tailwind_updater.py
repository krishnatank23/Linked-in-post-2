import os
import re

files_to_update = [
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\pages\StudioPage.tsx",
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\pages\WorkflowReviewPage.tsx",
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\pages\ResultsPage.tsx",
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\components\AgentCard.tsx"
]

replacements = [
    (r"bg-white/5", r"bg-black/5"),
    (r"bg-white/10", r"bg-black/10"),
    (r"bg-white/15", r"bg-black/15"),
    (r"bg-white/20", r"bg-black/20"),
    (r"border-white/5", r"border-black/5"),
    (r"border-white/10", r"border-black/10"),
    (r"border-white/15", r"border-black/15"),
    (r"border-white/20", r"border-black/20"),
    (r"border-white/25", r"border-black/25"),
    (r"text-white/10", r"text-[#1c1a17]/20"),
    (r"text-white/20", r"text-[#1c1a17]/40"),
    (r"text-white/35", r"text-[#1c1a17]/50"),
    (r"text-white/40", r"text-[#1c1a17]/50"),
    (r"text-white/80", r"text-[#1c1a17]/80"),
    (r"text-white/85", r"text-[#1c1a17]/90"),
    (r"text-white", r"text-[#1c1a17]"),
    # Fix the Python script's previous weird replacements like #faf7f2 inside rgba!
    # Wait, the previous script replaced #020817 with #faf7f2 but didn't touch StudioPage's background styles which used inline tailwind or hardcoded rgb.
    # Let's fix specific hardcoded colors from StudioPage:
    (r"background:\s*'rgba\(250,247,242,0\.8\)'", r"background: 'rgba(255,255,255,0.6)'"),
    (r"background:\s*'rgba\(28,26,23,0\.7\)'", r"background: 'rgba(255,255,255,0.8)'"),
    (r"background:\s*'#faf7f2'", r"background: 'var(--cream)'"),
    (r"border:\s*'1px solid rgba\(180,160,140,0\.15\)'", r"border: '1px solid rgba(180,160,140,0.3)'"),
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
        
print("Tailwind classes updated successfully!")

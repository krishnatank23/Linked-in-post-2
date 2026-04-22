import os
import re

files_to_update = [
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\pages\StudioPage.tsx",
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\pages\WorkflowReviewPage.tsx",
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\pages\ResultsPage.tsx",
    r"c:\Users\Krishna Tank\OneDrive - World Goods Market Limited\vscode backup\vs_code\Linked-in-post-2\frontend\src\components\AgentCard.tsx"
]

replacements = [
    (r"#020817", r"#faf7f2"),
    (r"rgba\(2,8,23,", r"rgba(255,255,255,"),
    
    # Text and Border conversions (white to dark/brownish)
    (r"rgba\(255,255,255,0\.03\)", r"rgba(180,160,140,0.1)"),
    (r"rgba\(255,255,255,0\.04\)", r"rgba(180,160,140,0.12)"),
    (r"rgba\(255,255,255,0\.05\)", r"rgba(180,160,140,0.15)"),
    (r"rgba\(255,255,255,0\.06\)", r"rgba(180,160,140,0.15)"),
    (r"rgba\(255,255,255,0\.08\)", r"rgba(180,160,140,0.2)"),
    (r"rgba\(255,255,255,0\.1\)", r"rgba(180,160,140,0.25)"),
    (r"rgba\(255,255,255,0\.12\)", r"rgba(180,160,140,0.3)"),
    (r"rgba\(255,255,255,0\.15\)", r"rgba(180,160,140,0.35)"),
    (r"rgba\(255,255,255,0\.18\)", r"rgba(180,160,140,0.4)"),
    (r"rgba\(255,255,255,0\.2\)", r"rgba(90,85,80,0.4)"),
    (r"rgba\(255,255,255,0\.22\)", r"rgba(90,85,80,0.45)"),
    (r"rgba\(255,255,255,0\.25\)", r"rgba(90,85,80,0.5)"),
    (r"rgba\(255,255,255,0\.3\)", r"rgba(90,85,80,0.55)"),
    (r"rgba\(255,255,255,0\.32\)", r"rgba(90,85,80,0.6)"),
    (r"rgba\(255,255,255,0\.35\)", r"rgba(90,85,80,0.65)"),
    (r"rgba\(255,255,255,0\.4\)", r"rgba(90,85,80,0.7)"),
    (r"rgba\(255,255,255,0\.45\)", r"rgba(90,85,80,0.75)"),
    (r"rgba\(255,255,255,0\.5\)", r"rgba(90,85,80,0.8)"),
    (r"rgba\(255,255,255,0\.6\)", r"rgba(28,26,23,0.7)"),
    (r"rgba\(255,255,255,0\.65\)", r"rgba(28,26,23,0.75)"),
    (r"rgba\(255,255,255,0\.7\)", r"rgba(28,26,23,0.8)"),
    (r"rgba\(255,255,255,0\.75\)", r"rgba(28,26,23,0.85)"),
    (r"rgba\(255,255,255,0\.8\)", r"rgba(28,26,23,0.9)"),
    (r"rgba\(255,255,255,0\.85\)", r"rgba(28,26,23,0.95)"),
    (r"rgba\(255,255,255,0\.9\)", r"rgba(28,26,23,0.98)"),
    
    (r"color:\s*'#fff'", r"color: '#1c1a17'"),
    (r'color:\s*"#fff"', r'color: "#1c1a17"'),
    (r"text-white", r"text-[#1c1a17]"),
    
    # Specific primary button backgrounds -> dark
    (r"linear-gradient\(135deg,\s*#0891b2,\s*#1d4ed8,\s*#7c3aed\)", r"#1c1a17"),
    (r"linear-gradient\(135deg,\s*#06b6d4,\s*#3b82f6,\s*#8b5cf6\)", r"#c9714f"), # terracota
    
    # Base borders
    (r"rgba\(6,182,212,0\.1\)", r"rgba(180,160,140,0.2)"),
    (r"rgba\(6,182,212,0\.15\)", r"rgba(180,160,140,0.25)"),
    (r"rgba\(6,182,212,0\.08\)", r"rgba(180,160,140,0.15)"),
    (r"rgba\(6,182,212,0\.2\)", r"rgba(180,160,140,0.3)"),
    (r"rgba\(6,182,212,0\.35\)", r"rgba(180,160,140,0.4)"),
    
    (r"rgba\(0,0,0,0\.3\)", r"rgba(50,40,30,0.1)"),
    (r"rgba\(0,0,0,0\.2\)", r"rgba(50,40,30,0.08)"),
    (r"rgba\(0,0,0,0\.15\)", r"rgba(50,40,30,0.05)"),
    (r"rgba\(0,0,0,0\.4\)", r"rgba(50,40,30,0.15)"),
    
    (r"'Space Grotesk'", r"'DM Sans'"),
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
        
print("Theme updated successfully!")

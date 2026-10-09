import os, glob

for filepath in glob.glob('d:/CampusBiz/Campus-Green-Biz/src/**/*.tsx', recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '.replace("@campus.com", "")' in content:
        new_content = content.replace('.replace("@campus.com", "")', '.split("@")[0]')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {filepath}')

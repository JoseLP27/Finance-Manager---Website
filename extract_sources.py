from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from pypdf import PdfReader
import re

root = Path(__file__).resolve().parent
out = root / 'docs' / 'reference-extracts'
out.mkdir(parents=True, exist_ok=True)
for p in (root.parent / 'Archivos claves').iterdir():
    parts=[]
    if p.suffix == '.pdf':
        parts=[f'PAGE {i+1}\n{page.extract_text()}' for i,page in enumerate(PdfReader(p).pages)]
    else:
        with ZipFile(p) as z:
            names=z.namelist()
            if p.suffix=='.pptx':
                names=sorted([n for n in names if re.match(r'ppt/slides/slide\d+\.xml$',n)],key=lambda n:int(re.search(r'(\d+)\.xml',n).group(1)))
            elif p.suffix=='.docx': names=['word/document.xml']
            else: names=[n for n in names if n.startswith('xl/') and (n.endswith('sharedStrings.xml') or 'worksheets/sheet' in n or n=='xl/workbook.xml') and n.endswith('.xml')]
            for name in names:
                tree=ET.fromstring(z.read(name))
                if p.suffix=='.xlsx':
                    parts.append(name+'\n'+z.read(name).decode())
                else: parts.append(name+'\n'+'\n'.join(t.text or '' for t in tree.iter() if t.tag.endswith('}t')))
    (out/(p.stem+'.txt')).write_text('\n\n'.join(parts),encoding='utf-8')
print('Extracted', len(list(out.iterdir())), 'reference files')

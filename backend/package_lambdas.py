import zipfile
import os

src_dir = os.path.join('backend', 'src')
build_dir = os.path.join('backend', 'build')
os.makedirs(build_dir, exist_ok=True)

handlers = ['auth_handler', 'planeaciones_handler', 'pricing_handler', 'purchase_handler']

for handler in handlers:
    zip_path = os.path.join(build_dir, handler + '.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(src_dir):
            for file in files:
                if file.endswith('.pyc'):
                    continue
                filepath = os.path.join(root, file)
                rel = os.path.relpath(filepath, os.path.dirname(src_dir))
                arcname = rel.replace(os.sep, '/')
                zf.write(filepath, arcname)
    size = round(os.path.getsize(zip_path) / 1024, 1)
    print(f'{handler}.zip: {size} KB')

print('All function ZIPs created.')

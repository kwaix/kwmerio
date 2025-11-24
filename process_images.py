import os
from PIL import Image

def crop_sprites(image_path, output_dir):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        width, height = img.size
        
        # Simple heuristic to find bounding boxes of isolated sprites
        # We will scan for non-transparent pixels and group them.
        # Since implementing a full connected component labeling from scratch is complex,
        # we will assume they are somewhat grid-aligned or separated by transparency.
        
        # Actually, let's use a simpler approach:
        # 1. Project to X and Y axes to find gaps.
        # But if they overlap in X or Y projection, this fails.
        
        # Alternative: Use a naive flood fill or just split by fixed grid if they look like a grid.
        # The prompt said: 
        # Top Left: Turtle
        # Top Right: Mouse
        # Center: Larva
        # Bottom Left: Slime
        # Bottom Right: Shark
        
        # This implies a 2x3 or 3x3 grid-like structure, or maybe 5 distinct spots.
        # Let's try to detect islands of opaque pixels.
        
        pixels = img.load()
        visited = set()
        components = []

        def get_neighbors(x, y):
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0: continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        yield nx, ny

        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a > 0 and (x, y) not in visited:
                    # Start a new component
                    min_x, max_x = x, x
                    min_y, max_y = y, y
                    stack = [(x, y)]
                    visited.add((x, y))
                    
                    while stack:
                        cx, cy = stack.pop()
                        min_x = min(min_x, cx)
                        max_x = max(max_x, cx)
                        min_y = min(min_y, cy)
                        max_y = max(max_y, cy)
                        
                        # Check neighbors (4-connectivity is usually enough for bounding box)
                        # optimization: skip if already visited
                        for nx, ny in [(cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1)]:
                            if 0 <= nx < width and 0 <= ny < height:
                                if (nx, ny) not in visited:
                                    nr, ng, nb, na = pixels[nx, ny]
                                    if na > 0:
                                        visited.add((nx, ny))
                                        stack.append((nx, ny))
                    
                    # Store component
                    components.append((min_x, min_y, max_x, max_y))

        # Filter out very small components (noise)
        components = [c for c in components if (c[2]-c[0]) > 10 and (c[3]-c[1]) > 10]
        
        # Sort components to map them to the names
        # Sort by Y first (rows), then X (columns)
        # We can bin Y into rows.
        
        # Center of the box
        centers = []
        for box in components:
            cx = (box[0] + box[2]) / 2
            cy = (box[1] + box[3]) / 2
            centers.append({'cx': cx, 'cy': cy, 'box': box})
            
        centers.sort(key=lambda k: k['cy'])
        
        # Now we have them roughly sorted top to bottom.
        # Expected:
        # Row 1: Turtle (Left), Mouse (Right)
        # Row 2: Larva (Center)
        # Row 3: Slime (Left), Shark (Right)
        
        # Let's see how many we found
        print(f"Found {len(components)} components.")
        
        if len(components) != 5:
            print("Warning: Did not find exactly 5 components. Saving them as detected_0.png, etc.")
            # Just save them all
            for i, c in enumerate(components):
                 box = c
                 sprite = img.crop(box)
                 sprite.save(os.path.join(output_dir, f"enemy_detected_{i}.png"))
            return

        # Assign names based on sorted positions
        # Re-sort to handle the grid logic
        # 3 rows roughly?
        
        # Let's categorize by Y buckets.
        min_y = min(c['cy'] for c in centers)
        max_y = max(c['cy'] for c in centers)
        height_span = max_y - min_y
        
        rows = [[], [], []] # Top, Middle, Bottom
        
        for c in centers:
            # simple thresholding
            if c['cy'] < min_y + height_span * 0.33:
                rows[0].append(c)
            elif c['cy'] < min_y + height_span * 0.66:
                rows[1].append(c)
            else:
                rows[2].append(c)
        
        # Sort each row by X
        for r in rows:
            r.sort(key=lambda k: k['cx'])
            
        # Mapping:
        # Row 0: Turtle, Mouse
        # Row 1: Larva
        # Row 2: Slime, Shark
        
        # NOTE: The user said:
        # Top Left: Turtle
        # Top Right: Mouse
        # Center: Larva
        # Bottom Left: Slime
        # Bottom Right: Shark
        
        # If Row 0 has 2: left=Turtle, right=Mouse
        # If Row 1 has 1: Larva
        # If Row 2 has 2: left=Slime, right=Shark
        
        mapping = {}
        
        if len(rows[0]) >= 1: mapping['turtle'] = rows[0][0]
        if len(rows[0]) >= 2: mapping['mouse'] = rows[0][1]
        
        if len(rows[1]) >= 1: mapping['larva'] = rows[1][0]
        
        if len(rows[2]) >= 1: mapping['slime'] = rows[2][0]
        if len(rows[2]) >= 2: mapping['shark'] = rows[2][1]

        # Save files
        for name, item in mapping.items():
            box = item['box']
            sprite = img.crop(box)
            sprite.save(os.path.join(output_dir, f"{name}.png"))
            print(f"Saved {name}.png at {box}")
            
    except Exception as e:
        print(f"Error: {e}")

crop_sprites("/tmp/file_attachments/Gemini_Generated_Image_bojmywbojmywbojm.png", "public")

import os
from PIL import Image

def process_and_crop(image_path, output_dir):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        width, height = img.size
        
        # Grid based crop
        # 1024x1024
        # Top Left: Turtle: (0, 0) to (341, 341)
        # Top Right: Mouse: (683, 0) to (1024, 341)
        # Center: Larva: (341, 341) to (683, 683)
        # Bottom Left: Slime: (0, 683) to (341, 1024)
        # Bottom Right: Shark: (683, 683) to (1024, 1024)

        crops = {
            'turtle': (0, 0, 341, 341),
            'mouse': (683, 0, 1024, 341),
            'larva': (341, 341, 683, 683),
            'slime': (0, 683, 341, 1024),
            'shark': (683, 683, 1024, 1024)
        }

        # Background color to remove (approximate light blue)
        # We will scan each cropped image and replace pixels close to the corner color with transparent.
        
        for name, box in crops.items():
            sprite = img.crop(box)
            
            # Remove background
            # Get corner colors of this specific sprite to be safe
            bg_colors = [
                sprite.getpixel((0, 0)),
                sprite.getpixel((sprite.width-1, 0)),
                sprite.getpixel((0, sprite.height-1)),
                sprite.getpixel((sprite.width-1, sprite.height-1))
            ]
            
            # Average or just pick one? Let's iterate pixels.
            datas = sprite.getdata()
            new_data = []
            
            # Simple distance threshold
            threshold = 30
            
            # Use the top-left pixel as reference for background
            ref_bg = sprite.getpixel((0,0))
            
            for item in datas:
                # item is (r, g, b, a)
                r, g, b, a = item
                
                # Check distance to ANY of the corner colors? Or just the top-left?
                # The gradient might be strong.
                # Let's check distance to top-left.
                dist = ((r - ref_bg[0])**2 + (g - ref_bg[1])**2 + (b - ref_bg[2])**2)**0.5
                
                # Also check if it's generally "light blue-ish" if the corners are different
                # But let's stick to corner reference for now.
                
                if dist < threshold:
                    new_data.append((255, 255, 255, 0)) # Transparent
                else:
                    new_data.append(item)
                    
            sprite.putdata(new_data)
            
            # Now trim the transparency (autocrop)
            bbox = sprite.getbbox()
            if bbox:
                sprite = sprite.crop(bbox)
                
            sprite.save(os.path.join(output_dir, f"{name}.png"))
            print(f"Saved {name}.png")

    except Exception as e:
        print(f"Error processing enemies: {e}")

def copy_character(image_path, output_dir):
    try:
        img = Image.open(image_path)
        img.save(os.path.join(output_dir, "character.png"))
        print("Saved character.png")
    except Exception as e:
        print(f"Error processing character: {e}")

process_and_crop("/tmp/file_attachments/Gemini_Generated_Image_bojmywbojmywbojm.png", "public")
copy_character("/tmp/file_attachments/키우미 측면 캐릭터.png", "public")

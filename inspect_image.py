import os
from PIL import Image

def inspect_image(image_path):
    try:
        img = Image.open(image_path)
        print(f"Mode: {img.mode}")
        print(f"Size: {img.size}")
        
        # Check corner pixels
        corners = [
            (0, 0),
            (img.width - 1, 0),
            (0, img.height - 1),
            (img.width - 1, img.height - 1)
        ]
        
        for c in corners:
            print(f"Pixel at {c}: {img.getpixel(c)}")
            
        # Check center pixel
        center = (img.width // 2, img.height // 2)
        print(f"Pixel at {center}: {img.getpixel(center)}")
        
    except Exception as e:
        print(f"Error: {e}")

inspect_image("/tmp/file_attachments/Gemini_Generated_Image_bojmywbojmywbojm.png")

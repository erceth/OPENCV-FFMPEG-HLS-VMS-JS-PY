import cv2
import sys
import os
import numpy as np
sys.path.insert(0, 'node_modules/motion-pedestrian-detection')
import detect

index = sys.argv[1]
height = int(sys.argv[2])
width = int(sys.argv[3])
minPixelSize = int(sys.argv[4])
motionDeltaThreshold = int(sys.argv[5])
motionPaddingCutoutPercent = float(sys.argv[6])
cutOutHeightLimit = int(sys.argv[7])
checkNLargestObjects = int(sys.argv[8])
windowStride = int(sys.argv[9])
hogPadding = int(sys.argv[10])
hogScale = float(sys.argv[11])
hogHitThreshold = int(sys.argv[12])
nonMaxSuppressionThreshold = float(sys.argv[13])
imshow = int(sys.argv[14])
writeOutput = int(sys.argv[15])
writeTransparentOutput = int(sys.argv[16])

detector = detect.Detect(index,height,width,minPixelSize,motionDeltaThreshold,motionPaddingCutoutPercent,cutOutHeightLimit,checkNLargestObjects,windowStride,hogPadding,hogScale,hogHitThreshold,nonMaxSuppressionThreshold,imshow,writeOutput,writeTransparentOutput)

while True:
  try:
    raw_data = sys.stdin.buffer.read(width*height*3)

    # Convert the bytes read into a NumPy array, and reshape it to video frame dimensions
    frame = np.fromstring(raw_data, np.uint8)
    frame = frame.reshape((height, width, 3))
    
    detector.processFrame(frame)

  except cv2.error as e:
    print('python exception', e, flush=True)
    continue

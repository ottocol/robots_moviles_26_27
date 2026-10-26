import sys, cv2, numpy as np
img = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED)
min_area = int(sys.argv[3]) if len(sys.argv) > 3 else 10
occ = (img < 100).astype(np.uint8)            # ocupado = oscuro
n, lab, stats, _ = cv2.connectedComponentsWithStats(occ, connectivity=8)
small = stats[:, cv2.CC_STAT_AREA] < min_area
small[0] = False                               # el fondo no
img[small[lab]] = 254                          # pasa a libre
cv2.imwrite(sys.argv[2], img)
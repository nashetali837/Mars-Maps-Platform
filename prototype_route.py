import numpy as np
import rasterio
from rasterio.transform import from_origin
import heapq
import math
import sys
from scipy.ndimage import generic_filter

# ---------- Utilities ----------
def make_synthetic_dem(w=200, h=200, hill_center=None):
    if hill_center is None:
        hill_center = (w//2, h//2)
    x = np.linspace(-1,1,w)
    y = np.linspace(-1,1,h)
    xx, yy = np.meshgrid(x,y)
    dem = 1000 + 200 * np.exp(-5*((xx)**2 + (yy)**2))  # gaussian hill
    dem += 10 * np.random.randn(h,w)  # noise
    return dem

def compute_slope(dem, transform):
    # slope magnitude in rise/run (unitless)
    dzdx = (np.roll(dem, -1, axis=1) - np.roll(dem, 1, axis=1)) / (2 * transform[0])
    dzdy = (np.roll(dem, -1, axis=0) - np.roll(dem, 1, axis=0)) / (2 * abs(transform[4]))
    slope = np.hypot(dzdx, dzdy)
    return slope

def compute_roughness(dem, size=3):
    def std_func(window):
        return np.std(window)
    rough = generic_filter(dem, std_func, size=size)
    return rough

# ---------- A* ----------
def heuristic(a, b, avg_slope_factor=0.0):
    (x1,y1) = a
    (x2,y2) = b
    dx = x2 - x1
    dy = y2 - y1
    dist = math.hypot(dx, dy)
    return dist * (1 + avg_slope_factor)

def neighbors(node, shape):
    x,y = node
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            if dx==0 and dy==0: continue
            nx, ny = x+dx, y+dy
            if 0 <= nx < shape[0] and 0 <= ny < shape[1]:
                yield (nx, ny)

def astar(start, goal, cost_grid, slope_grid, rough_grid, weights):
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    gscore = {start: 0}
    fscore = {start: heuristic(start, goal, avg_slope_factor=weights['slope'])}
    while open_set:
        _, current = heapq.heappop(open_set)
        if current == goal:
            path = []
            n = current
            while n in came_from:
                path.append(n)
                n = came_from[n]
            path.append(start)
            path.reverse()
            return path
        for nb in neighbors(current, cost_grid.shape):
            dx = nb[0]-current[0]
            dy = nb[1]-current[1]
            dist = math.hypot(dx, dy)
            slope = abs(slope_grid[nb])
            rough = rough_grid[nb]
            edge_cost = dist * (1 + weights['slope']*slope + weights['rough']*rough)
            tentative_g = gscore[current] + edge_cost
            if tentative_g < gscore.get(nb, float('inf')):
                came_from[nb] = current
                gscore[nb] = tentative_g
                f = tentative_g + heuristic(nb, goal, avg_slope_factor=weights['slope'])
                heapq.heappush(open_set, (f, nb))
    return None

def main():
    print("OSS Mars Routing Prototype (CUDA-Ready Structure)")
    dem = make_synthetic_dem(300,300)
    transform = (1.0, 0.0, 0.0, 0.0, -1.0, 0.0)
    slope = compute_slope(dem, transform)
    rough = compute_roughness(dem, size=5)
    cost_grid = np.ones_like(dem)
    start, goal = (10, 10), (280, 280)
    weights = {'slope': 5.0, 'rough': 2.0}
    path = astar(start, goal, cost_grid, slope, rough, weights)
    if path:
        print(f"Path planning successful. Found {len(path)} nodes.")
    else:
        print("No path found.")

if __name__ == '__main__':
    main()

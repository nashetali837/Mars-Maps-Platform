import numpy as np
import random

class Particle:
    def __init__(self, bounds):
        self.position = np.array([random.uniform(b[0], b[1]) for b in bounds])
        self.velocity = np.zeros_like(self.position)
        self.best_pos = self.position.copy()
        self.best_score = float('inf')

def swarm_optimize_weights(objective_func, bounds, n_particles=20, iterations=50):
    """
    Particle Swarm Optimization (PSO) to find optimal routing weights.
    Globally optimizes the A* cost factors based on mission objectives.
    """
    particles = [Particle(bounds) for _ in range(n_particles)]
    global_best_pos = None
    global_best_score = float('inf')

    # PSO Constants
    w = 0.5  # Inertia
    c1 = 0.8 # Cognitive weight
    c2 = 0.9 # Social weight

    for _ in range(iterations):
        for p in particles:
            score = objective_func(p.position)
            
            if score < p.best_score:
                p.best_score = score
                p.best_pos = p.position.copy()
                
            if score < global_best_score:
                global_best_score = score
                global_best_pos = p.position.copy()

        for p in particles:
            r1, r2 = random.random(), random.random()
            p.velocity = (w * p.velocity + 
                          c1 * r1 * (p.best_pos - p.position) + 
                          c2 * r2 * (global_best_pos - p.position))
            p.position += p.velocity
            
            # Clamp to bounds
            for i in range(len(bounds)):
                p.position[i] = np.clip(p.position[i], bounds[i][0], bounds[i][1])

    return global_best_pos, global_best_score

def routing_objective(weights_arr):
    # This is a dummy objective function. 
    # In practice, it would run multiple simulations and measure energy vs time.
    slope_weight, rough_weight = weights_arr
    # Penalize extreme values
    return abs(slope_weight - 5.0) + abs(rough_weight - 2.0) + random.uniform(0, 0.1)

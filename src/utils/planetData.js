// Planet data for the solar system visualization

/** Orbit parameters per planet (distances scaled up for visibility). */
export const planetOrbitData = {
  Mercury: {
    a: 8, b: 7.8, period: 88, inclination: 7,
    radius: 0.7, texture: 'textures/mercury.jpg'
  },
  Venus: {
    a: 12, b: 11.9, period: 225, inclination: 3.4,
    radius: 1, texture: 'textures/venus.jpg'
  },
  Earth: {
    a: 16, b: 15.98, period: 365, inclination: 0,
    radius: 1.2, texture: 'textures/earth.jpg'
  },
  Mars: {
    a: 20, b: 19.8, period: 687, inclination: 1.85,
    radius: 1, texture: 'textures/mars.jpg'
  },
  Jupiter: {
    a: 28, b: 27.9, period: 4333, inclination: 1.3,
    radius: 2, texture: 'textures/jupiter.jpg'
  },
  Saturn: {
    a: 38, b: 37.8, period: 10759, inclination: 2.5,
    radius: 1.8, texture: 'textures/saturn.jpg', hasRings: true, ringType: 'saturn'
  },
  Uranus: {
    a: 48, b: 47.8, period: 30687, inclination: 0.8,
    radius: 1.4, texture: 'textures/uranus.jpg', hasRings: true, ringType: 'uranus'
  },
  Neptune: {
    a: 58, b: 57.8, period: 60190, inclination: 1.8,
    radius: 1.3, texture: 'textures/neptune.jpg', hasRings: true, ringType: 'neptune'
  },
  Pluto: {
    a: 68, b: 67.5, period: 90520, inclination: 17.2,
    radius: 0.5, texture: 'textures/pluto.jpg'
  },
};

/** Planet info for the selector and info panel. */
export const planetData = {
  Mercury: {
    texture: 'textures/mercury.jpg',
    symbol: '☿',
    facts: {
      diameter: '4,879 km',
      distanceFromSun: '57.9M km',
      orbitalPeriod: '88 days',
      moons: 0,
      description: 'Smallest planet in the solar system. A day on Mercury lasts longer than its year.',
    },
  },
  Venus: {
    texture: 'textures/venus.jpg',
    symbol: '♀',
    facts: {
      diameter: '12,104 km',
      distanceFromSun: '108.2M km',
      orbitalPeriod: '225 days',
      moons: 0,
      description: 'Hottest planet at 465 °C. Its thick CO₂ atmosphere traps heat in a runaway greenhouse effect.',
    },
  },
  Earth: {
    texture: 'textures/earth.jpg',
    symbol: '♁',
    facts: {
      diameter: '12,742 km',
      distanceFromSun: '149.6M km',
      orbitalPeriod: '365.25 days',
      moons: 1,
      description: 'The only known planet with life. 71% of its surface is covered by liquid water.',
    },
  },
  Mars: {
    texture: 'textures/mars.jpg',
    symbol: '♂',
    facts: {
      diameter: '6,779 km',
      distanceFromSun: '227.9M km',
      orbitalPeriod: '687 days',
      moons: 2,
      description: 'Home to Olympus Mons — the tallest volcano in the solar system at 22 km high.',
    },
  },
  Jupiter: {
    texture: 'textures/jupiter.jpg',
    symbol: '♃',
    facts: {
      diameter: '139,820 km',
      distanceFromSun: '778.5M km',
      orbitalPeriod: '11.9 years',
      moons: 95,
      description: 'Largest planet, more massive than all others combined. Its Great Red Spot is a storm older than 350 years.',
    },
  },
  Saturn: {
    texture: 'textures/saturn.jpg',
    symbol: '♄',
    facts: {
      diameter: '116,460 km',
      distanceFromSun: '1.43B km',
      orbitalPeriod: '29.5 years',
      moons: 146,
      description: 'Least dense planet — it would float on water. Its rings are made of ice and rock up to 1 km thick.',
    },
  },
  Uranus: {
    texture: 'textures/uranus.jpg',
    symbol: '⛢',
    facts: {
      diameter: '50,724 km',
      distanceFromSun: '2.87B km',
      orbitalPeriod: '84 years',
      moons: 27,
      description: 'Rotates on its side with an axial tilt of 98°. Its rings are oriented vertically.',
    },
  },
  Neptune: {
    texture: 'textures/neptune.jpg',
    symbol: '♆',
    facts: {
      diameter: '49,244 km',
      distanceFromSun: '4.5B km',
      orbitalPeriod: '165 years',
      moons: 16,
      description: 'Windiest planet with gusts reaching 2,100 km/h. Its moon Triton orbits backwards.',
    },
  },
  Pluto: {
    texture: 'textures/pluto.jpg',
    symbol: '♇',
    facts: {
      diameter: '2,376 km',
      distanceFromSun: '5.9B km',
      orbitalPeriod: '248 years',
      moons: 5,
      description: 'Reclassified as a dwarf planet in 2006. New Horizons revealed a heart-shaped nitrogen ice plain in 2015.',
    },
  },
};

export const getPlanetNames = () => Object.keys(planetOrbitData);

export const getPlanetData = (planetName) => {
  return planetOrbitData[planetName] || null;
};

export const getPlanetsWithRings = () => {
  return Object.entries(planetOrbitData).filter(([, data]) => data.hasRings).map(([name]) => name);
};

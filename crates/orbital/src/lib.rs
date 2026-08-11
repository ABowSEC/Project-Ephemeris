//! Orbital and solar geometry for Ephemeris, compiled to WebAssembly.
//!
//! Why Rust here at all: the launch pages themselves are fetch-and-render and
//! would gain nothing from WebAssembly. This crate exists for the work that
//! *is* numerical — SGP4 propagation and pass prediction for the ISS pages,
//! and satellite visibility later. That work wants a real numeric type system,
//! exhaustive tests, and no floating-point surprises, which is a poor fit for
//! the JS side of this codebase and a good fit for this one.
//!
//! It starts with solar geometry because that is the part of the pass
//! predictor that can be verified against facts anyone can check — the
//! solstice noon altitude, the midnight sun, which way the Sun culminates in
//! each hemisphere — so the coordinate transforms are known-good before
//! orbital mechanics is stacked on top. `observer::to_horizontal` is the exact
//! function SGP4 output will flow through.
//!
//! The one thing it does today that ships to users: telling a visitor whether
//! a launch happens in the twilight window where the exhaust plume lights up.

mod observer;
mod solar;

use observer::{is_twilight_launch, solar_horizontal, LightPhase, Observer};
use wasm_bindgen::prelude::*;

/// Lighting conditions at a location and time.
#[wasm_bindgen]
pub struct Lighting {
    altitude: f64,
    azimuth: f64,
    phase: String,
    twilight_launch: bool,
}

#[wasm_bindgen]
impl Lighting {
    /// Sun's altitude in degrees. Negative is below the horizon.
    #[wasm_bindgen(getter)]
    pub fn altitude(&self) -> f64 {
        self.altitude
    }

    /// Sun's compass bearing in degrees clockwise from true north.
    #[wasm_bindgen(getter)]
    pub fn azimuth(&self) -> f64 {
        self.azimuth
    }

    /// One of: day, civil-twilight, nautical-twilight, astronomical-twilight, night.
    #[wasm_bindgen(getter)]
    pub fn phase(&self) -> String {
        self.phase.clone()
    }

    /// True when the ground is dark but a rocket at altitude would be sunlit.
    #[wasm_bindgen(getter, js_name = twilightLaunch)]
    pub fn twilight_launch(&self) -> bool {
        self.twilight_launch
    }
}

/// Lighting conditions at a latitude/longitude for a Unix timestamp in ms.
///
/// `unix_ms` is an f64 because that is what `Date.getTime()` hands over, and
/// converting through i64 at the boundary would need BigInt on the JS side for
/// no benefit — f64 holds millisecond timestamps exactly well past year 10000.
#[wasm_bindgen(js_name = lightingAt)]
pub fn lighting_at(latitude: f64, longitude: f64, unix_ms: f64) -> Lighting {
    let observer = Observer {
        latitude,
        longitude,
    };
    let horizontal = solar_horizontal(observer, unix_ms);

    Lighting {
        altitude: horizontal.altitude,
        azimuth: horizontal.azimuth,
        phase: LightPhase::from_solar_altitude(horizontal.altitude)
            .as_str()
            .to_string(),
        twilight_launch: is_twilight_launch(horizontal.altitude),
    }
}

/// Sun's altitude in degrees. The cheap call, when the phase is not needed.
#[wasm_bindgen(js_name = solarAltitude)]
pub fn solar_altitude(latitude: f64, longitude: f64, unix_ms: f64) -> f64 {
    solar_horizontal(
        Observer {
            latitude,
            longitude,
        },
        unix_ms,
    )
    .altitude
}

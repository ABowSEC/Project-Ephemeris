//! Converting a sky position into what someone standing on the ground sees.
//!
//! This is the piece the ISS pass predictor will reuse verbatim: SGP4 gives a
//! satellite's position in an Earth-centred frame, and turning that into
//! "look 43° up, north-north-east, at 21:14" is exactly the transformation
//! below. Written against the Sun first because the Sun's position is easy to
//! verify independently, so the geometry can be trusted before anything
//! harder is stacked on top of it.

use crate::solar::{greenwich_mean_sidereal_time, normalize_degrees, solar_position, Equatorial};

/// Where to look: altitude above the horizon and compass azimuth, in degrees.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Horizontal {
    /// Degrees above the horizon. Negative means below it.
    pub altitude: f64,
    /// Degrees clockwise from true north.
    pub azimuth: f64,
}

/// An observer's position on the ground. Degrees, east-positive longitude.
#[derive(Debug, Clone, Copy)]
pub struct Observer {
    pub latitude: f64,
    pub longitude: f64,
}

/// Convert equatorial coordinates to horizontal ones for an observer and time.
pub fn to_horizontal(position: Equatorial, observer: Observer, unix_ms: f64) -> Horizontal {
    // Local hour angle: how far the object is past the observer's meridian.
    let local_sidereal = greenwich_mean_sidereal_time(unix_ms) + observer.longitude;
    let hour_angle = normalize_degrees(local_sidereal - position.right_ascension).to_radians();

    let latitude = observer.latitude.to_radians();
    let declination = position.declination.to_radians();

    let altitude = (latitude.sin() * declination.sin()
        + latitude.cos() * declination.cos() * hour_angle.cos())
    .asin();

    // North-based azimuth. The two-argument form avoids the quadrant ambiguity
    // that the single arctan version has near due north and due south.
    let azimuth = (-hour_angle.sin()).atan2(
        declination.tan() * latitude.cos() - latitude.sin() * hour_angle.cos(),
    );

    Horizontal {
        altitude: altitude.to_degrees(),
        azimuth: normalize_degrees(azimuth.to_degrees()),
    }
}

/// Where the Sun is, as seen from a point on the ground.
pub fn solar_horizontal(observer: Observer, unix_ms: f64) -> Horizontal {
    to_horizontal(solar_position(unix_ms), observer, unix_ms)
}

/// How dark it is, by the standard twilight bands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LightPhase {
    Day,
    /// Sun 0 to 6° below the horizon: bright enough to see without lights.
    CivilTwilight,
    /// 6 to 12° below: horizon still discernible at sea.
    NauticalTwilight,
    /// 12 to 18° below: sky not yet fully dark.
    AstronomicalTwilight,
    Night,
}

impl LightPhase {
    pub fn from_solar_altitude(altitude: f64) -> Self {
        if altitude > -0.833 {
            // -0.833° rather than 0: the Sun's disc has a radius, and
            // refraction lifts it further, so sunset is when the centre is
            // already slightly below the geometric horizon.
            LightPhase::Day
        } else if altitude > -6.0 {
            LightPhase::CivilTwilight
        } else if altitude > -12.0 {
            LightPhase::NauticalTwilight
        } else if altitude > -18.0 {
            LightPhase::AstronomicalTwilight
        } else {
            LightPhase::Night
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            LightPhase::Day => "day",
            LightPhase::CivilTwilight => "civil-twilight",
            LightPhase::NauticalTwilight => "nautical-twilight",
            LightPhase::AstronomicalTwilight => "astronomical-twilight",
            LightPhase::Night => "night",
        }
    }
}

/// Whether the lighting favours a visible exhaust plume.
///
/// The "twilight phenomenon" — the illuminated jellyfish plume visible for
/// hundreds of miles — needs the ground in darkness while the rocket climbs
/// into sunlight. That is the twilight band: the Sun below the observer's
/// horizon but not so far below that it fails to catch the vehicle at
/// altitude. Outside roughly -3° to -18° the effect does not occur.
pub fn is_twilight_launch(solar_altitude: f64) -> bool {
    (-18.0..=-3.0).contains(&solar_altitude)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc_ms(year: i64, month: i64, day: i64, hour: i64, minute: i64) -> f64 {
        let y = if month <= 2 { year - 1 } else { year };
        let era = if y >= 0 { y } else { y - 399 } / 400;
        let yoe = y - era * 400;
        let mp = (month + 9) % 12;
        let doy = (153 * mp + 2) / 5 + day - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        let days = era * 146_097 + doe - 719_468;
        ((days * 86_400 + hour * 3_600 + minute * 60) * 1000) as f64
    }

    const FORT_COLLINS: Observer = Observer {
        latitude: 40.585,
        longitude: -105.084,
    };

    #[test]
    fn solstice_noon_altitude_matches_the_geometric_prediction() {
        // At local solar noon on the June solstice the Sun's altitude is
        // 90 - latitude + obliquity. Fort Collins is UTC-6 in summer, so
        // solar noon is close to 19:00 UTC (a little later, since the site
        // sits west of its timezone meridian).
        let expected = 90.0 - FORT_COLLINS.latitude + 23.44;

        // Scan the hour around solar noon and take the peak, rather than
        // guessing the exact minute.
        let base = utc_ms(2025, 6, 21, 18, 30);
        let peak = (0..90)
            .map(|minute| solar_horizontal(FORT_COLLINS, base + (minute as f64) * 60_000.0).altitude)
            .fold(f64::MIN, f64::max);

        assert!((peak - expected).abs() < 0.5, "peak {peak}, expected {expected}");
    }

    #[test]
    fn sun_is_due_south_at_local_noon_in_the_northern_hemisphere() {
        let base = utc_ms(2025, 6, 21, 18, 30);
        let (_, azimuth) = (0..90)
            .map(|minute| {
                let h = solar_horizontal(FORT_COLLINS, base + (minute as f64) * 60_000.0);
                (h.altitude, h.azimuth)
            })
            .fold((f64::MIN, 0.0), |best, current| {
                if current.0 > best.0 {
                    current
                } else {
                    best
                }
            });

        // 180° is due south
        assert!((azimuth - 180.0).abs() < 1.0, "azimuth: {azimuth}");
    }

    #[test]
    fn sun_is_below_the_horizon_at_local_midnight() {
        // 06:00 UTC is around midnight in Colorado
        let altitude = solar_horizontal(FORT_COLLINS, utc_ms(2025, 6, 21, 6, 0)).altitude;
        assert!(altitude < 0.0, "altitude: {altitude}");
    }

    #[test]
    fn midnight_sun_stays_up_above_the_arctic_circle() {
        // Longyearbyen in June: the Sun never sets, so altitude stays positive
        // right through local midnight. Catches sign errors in the latitude
        // term that mid-latitude tests would let through.
        let svalbard = Observer {
            latitude: 78.22,
            longitude: 15.65,
        };
        for hour in 0..24 {
            let altitude = solar_horizontal(svalbard, utc_ms(2025, 6, 21, hour, 0)).altitude;
            assert!(altitude > 0.0, "hour {hour}: altitude {altitude}");
        }
    }

    #[test]
    fn southern_hemisphere_sun_culminates_to_the_north() {
        // Sydney in December: the midday Sun is north, not south. A hemisphere
        // sign error would put it at 180°.
        let sydney = Observer {
            latitude: -33.87,
            longitude: 151.21,
        };
        let base = utc_ms(2025, 12, 21, 0, 30);
        let (_, azimuth) = (0..90)
            .map(|minute| {
                let h = solar_horizontal(sydney, base + (minute as f64) * 60_000.0);
                (h.altitude, h.azimuth)
            })
            .fold((f64::MIN, 0.0), |best, current| {
                if current.0 > best.0 {
                    current
                } else {
                    best
                }
            });

        // Due north is 0/360
        assert!(azimuth < 2.0 || azimuth > 358.0, "azimuth: {azimuth}");
    }

    #[test]
    fn light_phases_split_at_the_standard_boundaries() {
        assert_eq!(LightPhase::from_solar_altitude(10.0), LightPhase::Day);
        assert_eq!(LightPhase::from_solar_altitude(-3.0), LightPhase::CivilTwilight);
        assert_eq!(LightPhase::from_solar_altitude(-9.0), LightPhase::NauticalTwilight);
        assert_eq!(
            LightPhase::from_solar_altitude(-15.0),
            LightPhase::AstronomicalTwilight
        );
        assert_eq!(LightPhase::from_solar_altitude(-30.0), LightPhase::Night);
    }

    #[test]
    fn twilight_launch_window_excludes_daylight_and_deep_night() {
        assert!(!is_twilight_launch(5.0));
        assert!(!is_twilight_launch(-1.0));
        assert!(is_twilight_launch(-8.0));
        assert!(is_twilight_launch(-17.0));
        assert!(!is_twilight_launch(-25.0));
    }
}

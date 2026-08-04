//! Position of the Sun.
//!
//! Low-precision algorithm from the Astronomical Almanac (the form Meeus
//! gives in *Astronomical Algorithms*, ch. 25). Accurate to roughly 0.01°
//! for dates within a couple of centuries of J2000 — far better than needed
//! for "is it dark at the pad", and it avoids pulling in a full ephemeris.
//!
//! Angles are degrees at every boundary and radians only inside the
//! trigonometry, because mixing the two silently is the classic way to get
//! answers that look plausible and are wrong.

/// Julian Day for the J2000.0 epoch.
const J2000: f64 = 2_451_545.0;
/// Julian Day at the Unix epoch (1970-01-01T00:00:00Z).
const UNIX_EPOCH_JD: f64 = 2_440_587.5;
const MS_PER_DAY: f64 = 86_400_000.0;

/// Julian Day from a Unix timestamp in milliseconds.
pub fn julian_day(unix_ms: f64) -> f64 {
    unix_ms / MS_PER_DAY + UNIX_EPOCH_JD
}

/// Days since J2000.0, the argument every term below is expressed in.
pub fn days_since_j2000(unix_ms: f64) -> f64 {
    julian_day(unix_ms) - J2000
}

/// Equatorial coordinates: right ascension and declination, both in degrees.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Equatorial {
    pub right_ascension: f64,
    pub declination: f64,
}

/// Normalize an angle in degrees to [0, 360).
pub fn normalize_degrees(degrees: f64) -> f64 {
    let wrapped = degrees % 360.0;
    if wrapped < 0.0 {
        wrapped + 360.0
    } else {
        wrapped
    }
}

/// Apparent position of the Sun at an instant.
pub fn solar_position(unix_ms: f64) -> Equatorial {
    let n = days_since_j2000(unix_ms);

    // Mean longitude and mean anomaly
    let mean_longitude = normalize_degrees(280.460 + 0.985_647_4 * n);
    let mean_anomaly = normalize_degrees(357.528 + 0.985_600_3 * n).to_radians();

    // Equation of the centre applied to reach the ecliptic longitude. The Sun
    // has no meaningful ecliptic latitude at this precision, so it is omitted.
    let ecliptic_longitude =
        (mean_longitude + 1.915 * mean_anomaly.sin() + 0.020 * (2.0 * mean_anomaly).sin())
            .to_radians();

    let obliquity = (23.439 - 0.000_000_4 * n).to_radians();

    // atan2 keeps the right ascension in the correct quadrant, which the
    // textbook arctan form does not.
    let right_ascension = normalize_degrees(
        (obliquity.cos() * ecliptic_longitude.sin())
            .atan2(ecliptic_longitude.cos())
            .to_degrees(),
    );
    let declination = (obliquity.sin() * ecliptic_longitude.sin()).asin().to_degrees();

    Equatorial {
        right_ascension,
        declination,
    }
}

/// Greenwich Mean Sidereal Time in degrees.
pub fn greenwich_mean_sidereal_time(unix_ms: f64) -> f64 {
    normalize_degrees(280.460_618_37 + 360.985_647_366_29 * days_since_j2000(unix_ms))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Milliseconds since the Unix epoch for a UTC calendar instant.
    /// Independent of the algorithms under test, so a bug in one can't hide a
    /// bug in the other.
    fn utc_ms(year: i64, month: i64, day: i64, hour: i64, minute: i64) -> f64 {
        // Howard Hinnant's days_from_civil
        let y = if month <= 2 { year - 1 } else { year };
        let era = if y >= 0 { y } else { y - 399 } / 400;
        let yoe = y - era * 400;
        let mp = (month + 9) % 12;
        let doy = (153 * mp + 2) / 5 + day - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        let days = era * 146_097 + doe - 719_468;
        ((days * 86_400 + hour * 3_600 + minute * 60) * 1000) as f64
    }

    #[test]
    fn julian_day_matches_known_epoch() {
        // 2000-01-01T12:00:00Z is J2000.0 by definition
        assert!((julian_day(utc_ms(2000, 1, 1, 12, 0)) - J2000).abs() < 1e-6);
        // 1970-01-01T00:00:00Z is the Unix epoch
        assert!((julian_day(0.0) - UNIX_EPOCH_JD).abs() < 1e-9);
    }

    #[test]
    fn declination_is_near_zero_at_equinoxes() {
        // The Sun crosses the celestial equator at both equinoxes
        let march = solar_position(utc_ms(2025, 3, 20, 9, 1));
        let september = solar_position(utc_ms(2025, 9, 22, 18, 19));
        assert!(march.declination.abs() < 0.3, "march: {}", march.declination);
        assert!(
            september.declination.abs() < 0.3,
            "september: {}",
            september.declination
        );
    }

    #[test]
    fn declination_reaches_the_obliquity_at_solstices() {
        // At the solstices the Sun stands over a tropic, at +/- the obliquity
        let june = solar_position(utc_ms(2025, 6, 21, 2, 42));
        let december = solar_position(utc_ms(2025, 12, 21, 15, 3));
        assert!(
            (june.declination - 23.44).abs() < 0.1,
            "june: {}",
            june.declination
        );
        assert!(
            (december.declination + 23.44).abs() < 0.1,
            "december: {}",
            december.declination
        );
    }

    #[test]
    fn right_ascension_is_zero_at_the_march_equinox() {
        // The March equinox is the origin of right ascension, so RA wraps
        // through 360 there — check both ends of the wrap.
        let ra = solar_position(utc_ms(2025, 3, 20, 9, 1)).right_ascension;
        assert!(ra < 0.5 || ra > 359.5, "ra: {ra}");
    }

    #[test]
    fn sidereal_time_advances_a_full_turn_per_sidereal_day() {
        // A sidereal day is ~3m56s shorter than a solar day
        let t0 = utc_ms(2025, 6, 1, 0, 0);
        let sidereal_day_ms = 86_164_090.5;
        let delta = (greenwich_mean_sidereal_time(t0 + sidereal_day_ms)
            - greenwich_mean_sidereal_time(t0))
        .abs();
        assert!(delta < 0.01 || delta > 359.99, "delta: {delta}");
    }

    #[test]
    fn normalize_handles_negative_and_large_angles() {
        assert!((normalize_degrees(-90.0) - 270.0).abs() < 1e-9);
        assert!((normalize_degrees(450.0) - 90.0).abs() < 1e-9);
        assert!((normalize_degrees(0.0) - 0.0).abs() < 1e-9);
    }
}

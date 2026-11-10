from crowd_forecast.config import AppConfig


def test_default_config_loads():
    config = AppConfig.default()

    assert config.anchor.sites, "Expected default sites to be populated"
    assert config.festival.festivals, "Expected default festivals to be populated"
    assert "Ambaji" in config.anchor.sites
    assert config.anchor.sites["Ambaji"].anchors.annual_visitors > 0

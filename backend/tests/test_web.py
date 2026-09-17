def test_deep_link_serves_built_react_app(client, tmp_path, monkeypatch):
    site = tmp_path / "site"
    site.mkdir()
    (site / "index.html").write_text("<div>Travel Globe</div>")
    monkeypatch.setenv("DIST_PATH", str(site))

    response = client.get("/locations/123")

    assert response.status_code == 200
    assert "Travel Globe" in response.text

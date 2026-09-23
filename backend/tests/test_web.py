def test_deep_link_serves_built_react_app(client, tmp_path, monkeypatch):
    site = tmp_path / "site"
    site.mkdir()
    (site / "index.html").write_text("<div>Travel Globe</div>")
    monkeypatch.setenv("DIST_PATH", str(site))

    response = client.get("/locations/123")

    assert response.status_code == 200
    assert "Travel Globe" in response.text


def test_web_path_cannot_escape_built_site(client, tmp_path, monkeypatch):
    site = tmp_path / "site"
    site.mkdir()
    (site / "index.html").write_text("<div>Travel Globe</div>")
    (tmp_path / "secret.txt").write_text("not public")
    monkeypatch.setenv("DIST_PATH", str(site))

    response = client.get("/%2e%2e%2fsecret.txt")

    assert response.status_code == 404
    assert "not public" not in response.text

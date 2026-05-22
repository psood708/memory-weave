from memoryweave.models.catalog import get_catalog, ModelRole

def test_catalog_has_all_roles():
    catalog = get_catalog()
    assert ModelRole.CHAT in catalog
    assert ModelRole.EMBEDDING in catalog
    assert ModelRole.JUDGE in catalog

def test_catalog_chat_has_models():
    catalog = get_catalog()
    assert len(catalog[ModelRole.CHAT]) >= 3

def test_catalog_models_have_required_fields():
    catalog = get_catalog()
    for role, models in catalog.items():
        for m in models:
            assert "id" in m
            assert "label" in m

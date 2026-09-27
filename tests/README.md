# Tests

Python unit tests cover query preprocessing and document chunking:

```powershell
python -m pytest tests/test_user_view.py tests/test_document_processing.py
```

Node API smoke tests require the Node server to be running on port 5000:

```powershell
node --test tests/node_api.test.js
```

Set `API_URL` to test another gateway URL.

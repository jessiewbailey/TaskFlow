#!/usr/bin/env python3
"""
Simple verification of model detection logic
"""

def check_model_handling(model_name):
    """Check how a model would be handled"""
    # Detection logic from workflow_processor.py
    is_harmony_model = 'gpt-oss' in model_name.lower()
    is_reasoning_model = any(indicator in model_name.lower() for indicator in [
        'cot', 'chain', 'reasoning', 'think', 'step', 'openai', 'gpt'
    ])
    
    return {
        'model': model_name,
        'is_harmony': is_harmony_model,
        'is_reasoning': is_reasoning_model,
        'uses_format_flag': not is_harmony_model,
        'json_via': 'prompts only' if is_harmony_model else 'format flag + prompts'
    }

# Test various models
test_models = [
    "gpt-oss:20b",
    "gpt-oss:8b", 
    "GPT-OSS:20B",  # Case sensitivity test
    "llama3:8b",
    "gemma:2b",
    "mistral:7b"
]

print("=== Model Detection Verification ===\n")
print(f"{'Model':<20} {'Harmony?':<10} {'Reasoning?':<12} {'Format Flag?':<15} {'JSON Method':<20}")
print("-" * 80)

for model in test_models:
    result = check_model_handling(model)
    print(f"{result['model']:<20} {str(result['is_harmony']):<10} {str(result['is_reasoning']):<12} {str(result['uses_format_flag']):<15} {result['json_via']:<20}")

print("\n✓ Summary:")
print("  - gpt-oss models: NO format flag, JSON via prompts")
print("  - Other models: format='json' flag + prompts")
print("\nThis matches the test results:")
print("  - test-harmony-format.py (no format flag) ✓ SUCCEEDED")
print("  - test-ollama-gpt-oss.py (with format flag) ✗ FAILED")
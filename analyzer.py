import re

def generate_ai_explanation(variable):
    return (
        f"The variable '{variable}' is accessed by multiple threads concurrently without synchronization. "
        f"Since the operation is not atomic, a thread might read the value, get preempted by another thread "
        f"which also reads and modifies the value. When the first thread resumes and writes its value back, "
        f"it overwrites the progress of the second thread, causing a 'Lost Update'."
    )

def generate_step_by_step(variable):
    return [
        f"Thread A reads the current value of '{variable}'.",
        f"Context switch occurs. Thread B reads the same value of '{variable}'.",
        f"Thread B modifies the value and writes it back to memory.",
        f"Thread A resumes, modifies its locally stored value, and writes it back.",
        f"Result: The update from Thread B is completely lost."
    ]

def generate_improved_fixed_code(variable, code_lines, locs):
    # This tries to generate a more context-aware fix snippet.
    snippet = []
    snippet.append("import threading")
    snippet.append(f"{variable}_lock = threading.Lock()\n")
    
    # Just taking the first occurrence to show a contextual fix
    first_loc = locs[0] - 1
    if first_loc < len(code_lines):
        indent = len(code_lines[first_loc]) - len(code_lines[first_loc].lstrip())
        indent_str = " " * indent
        snippet.append(f"{indent_str}with {variable}_lock:")
        snippet.append(f"    {code_lines[first_loc]}")
    else:
        snippet.append(f"with {variable}_lock:")
        snippet.append(f"    # Your operation on {variable} here")

    return "\n".join(snippet)

def detect_race_conditions(code, language='python'):
    lines = code.split('\n')
    shared_vars = set()
    accesses = {}
    
    # 1. Detect shared/global variables
    if language == 'python':
        for line in lines:
            if "global " in line:
                # Can be multiple variables: global a, b
                vars_part = line.split("global ")[1].split('#')[0]
                for v in vars_part.split(','):
                    shared_vars.add(v.strip())
    else:
        # Basic C detection: variables outside functions (rough heuristic)
        # Not perfect, just for demo impact
        for line in lines:
            if re.match(r'^(int|float|double|char)\s+([a-zA-Z_]\w*)\s*(?:=.*)?;\s*$', line.strip()):
                match = re.match(r'^(int|float|double|char)\s+([a-zA-Z_]\w*)\s*(?:=.*)?;\s*$', line.strip())
                if match:
                    shared_vars.add(match.group(2))

    # 2. Track usage of these shared variables
    for i, line in enumerate(lines):
        # Ignore comments
        clean_line = line.split('#')[0] if language == 'python' else line.split('//')[0]
        
        for var in shared_vars:
            # Match word boundaries to avoid partial matches
            pattern = rf'\b{var}\b'
            if re.search(pattern, clean_line) and "global " not in clean_line:
                if var not in accesses:
                    accesses[var] = []
                accesses[var].append(i + 1)

    race_conditions = []
    suggestions = []

    for var, locs in accesses.items():
        if len(locs) > 1:
            race_conditions.append({
                "variable": var,
                "lines": locs,
                "ai_explanation": generate_ai_explanation(var),
                "step_by_step": generate_step_by_step(var)
            })

            suggestions.append({
                "variable": var,
                "fix": f"Use a Mutex/Lock to synchronize access to '{var}'",
                "fixed_code": generate_improved_fixed_code(var, lines, locs)
            })

    return {
        "shared_variables": list(shared_vars),
        "race_conditions": race_conditions,
        "suggestions": suggestions,
        "total_issues": len(race_conditions)
    }
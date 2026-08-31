const PADDING_BLOCK: usize = 4096;

pub fn pad(json_str: &str) -> String {
    let base_len = json_str.len();
    let remainder = base_len % PADDING_BLOCK;
    if remainder == 0 {
        return json_str.to_string();
    }
    let padding_needed = PADDING_BLOCK - remainder;
    let trimmed = json_str.trim_end_matches('}');
    let mut padded = trimmed.to_string();
    padded.push(',');
    padded.push_str(&" ".repeat(padding_needed - 1));
    padded.push('}');
    padded
}

pub fn unpad(padded_str: &str) -> String {
    let without_brace = padded_str.trim_end_matches('}');
    let trimmed = without_brace.trim_end_matches([' ', ',']);
    trimmed.to_string() + "}"
}

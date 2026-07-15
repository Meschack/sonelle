use std::collections::BTreeSet;

pub fn list_system_font_families() -> Result<Vec<String>, String> {
    let mut database = fontdb::Database::new();
    database.load_system_fonts();

    let families = database
        .faces()
        .flat_map(|face| face.families.iter().map(|(family, _)| family.trim()))
        .filter(|family| !family.is_empty() && family.chars().count() <= 160)
        .map(ToOwned::to_owned)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();

    if families.is_empty() {
        return Err("We couldn't find the fonts installed on this computer.".to_string());
    }

    Ok(families)
}

#[cfg(test)]
mod tests {
    use super::list_system_font_families;

    #[test]
    fn discovers_sorted_unique_system_font_families() {
        let families = list_system_font_families().expect("system fonts should be available");
        let mut sorted = families.clone();
        sorted.sort();
        sorted.dedup();

        assert_eq!(families, sorted);
        assert!(families.iter().all(|family| !family.trim().is_empty()));
    }
}

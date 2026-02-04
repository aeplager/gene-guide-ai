"""
Genetic Web Scraper - Standalone scraper for ClinVar and MedlinePlus
No database dependencies - just returns the fetched data as dictionaries.
Outputs markdown-formatted text for better readability and LLM parsing.
"""
import os
import re
import time
import urllib.parse
from typing import Dict, List, Optional
import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md


# ==================== CONFIGURATION ====================

USER_AGENT = os.getenv("WEB_USER_AGENT", "GeneticApp/1.0 (+contact@yourapp.com)")
TIMEOUT = float(os.getenv("WEB_FETCH_TIMEOUT_MS", "20000")) / 1000.0

# Rate limiting tracker
_last_hit_ts: Dict[str, float] = {}


# ==================== RATE LIMITING ====================

def _rate_limit(host: str, rps: float = 1.0):
    """
    Rate limit requests to avoid overwhelming servers.
    
    Args:
        host: Domain name (e.g., "ncbi.nlm.nih.gov")
        rps: Requests per second allowed (default: 1.0)
    """
    interval = 1.0 / max(0.1, rps)
    now = time.time()
    last = _last_hit_ts.get(host, 0.0)
    wait = last + interval - now
    if wait > 0:
        time.sleep(wait)
    _last_hit_ts[host] = time.time()


# ==================== CLINVAR SCRAPER ====================

def search_clinvar(gene: str, mutation: str) -> Dict:
    """
    Search ClinVar for genetic variant information.
    
    Args:
        gene: Gene symbol (e.g., "BRCA1")
        mutation: Mutation/variant (e.g., "c.68_69del")
    
    Returns:
        Dict containing:
            - title: Page title
            - text: Full extracted text
            - url: ClinVar page URL
            - classification: "Pathogenic", "Benign", "VUS", or None
            - source: "ClinVar"
            - error: Error message if failed
    
    Example:
        result = search_clinvar("BRCA1", "c.68_69del")
        print(result["text"])
    """
    gene = gene.strip().upper()
    mutation = mutation.strip()
    
    # Build search query
    query = f"{gene} {mutation}"
    
    # Step 1: Search ClinVar
    search_url = "https://www.ncbi.nlm.nih.gov/clinvar/"
    params = {"term": query}
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
    }
    
    print(f"[ClinVar] Searching for: {query}")
    _rate_limit("ncbi.nlm.nih.gov", 1.0)  # Max 1 request per second
    
    try:
        resp = requests.get(search_url, params=params, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        return {"error": f"Search failed: {str(e)}", "source": "ClinVar"}
    
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # Step 2: Find the actual variant page URL
    variant_url = None
    
    # Prefer VCV (Variation) pages
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/clinvar/variation" in href or "/clinvar/VCV" in href:
            variant_url = urllib.parse.urljoin("https://www.ncbi.nlm.nih.gov", href)
            break
    
    # Fallback to RCV pages
    if not variant_url:
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/clinvar/RCV" in href:
                variant_url = urllib.parse.urljoin("https://www.ncbi.nlm.nih.gov", href)
                break
    
    if not variant_url:
        return {
            "error": f"No ClinVar page found for {gene} {mutation}",
            "source": "ClinVar"
        }
    
    # Step 3: Fetch the variant page
    print(f"[ClinVar] Fetching: {variant_url}")
    _rate_limit("ncbi.nlm.nih.gov", 1.0)
    
    try:
        resp = requests.get(variant_url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        return {
            "error": f"Page fetch failed: {str(e)}",
            "url": variant_url,
            "source": "ClinVar"
        }
    
    # Step 4: Parse the page
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # Remove navigation/footer
    for selector in ["nav", "header", "footer", ".ncbi-topnav", ".usa-footer", 
                     ".ncbi-alerts-area", ".ncbi-search", ".page-navigation"]:
        for element in soup.select(selector):
            element.decompose()
    
    # Extract title
    title = ""
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text().strip()
    if not title and soup.title:
        title = soup.title.string.strip()
    
    # Extract main content
    container = (soup.select_one("#maincontent") or 
                soup.select_one("#content") or 
                soup.find("body"))
    
    # Convert HTML to Markdown for better formatting
    # This preserves headings, lists, bold, italic, and links
    markdown_text = md(
        str(container),
        heading_style="ATX",  # Use # for headings
        bullets="-",  # Use - for bullet lists
        strip=["script", "style", "img"],  # Remove these tags
        escape_asterisks=False,  # Keep markdown bold/italic
        escape_underscores=False
    )
    
    # Clean up excessive whitespace while preserving structure
    lines = [line.strip() for line in markdown_text.split('\n')]
    lines = [line for line in lines if line]  # Remove empty lines
    full_text = '\n\n'.join(lines)
    
    # Limit size to prevent huge documents
    if len(full_text) > 50000:  # ~50KB limit
        full_text = full_text[:50000] + "\n\n[Content truncated for length]"
    
    # Extract classification
    classification = None
    classification_patterns = [
        ("Pathogenic", r"(?<!Likely )Pathogenic(?! /uncertain)"),
        ("Likely pathogenic", r"Likely pathogenic"),
        ("Benign", r"(?<!Likely )Benign"),
        ("Likely benign", r"Likely benign"),
        ("VUS", r"Uncertain significance|VUS|Conflicting"),
    ]
    
    for class_name, pattern in classification_patterns:
        if re.search(pattern, full_text, re.IGNORECASE):
            classification = class_name
            break
    
    print(f"[ClinVar] Success - Classification: {classification}")
    
    return {
        "title": title,
        "text": full_text,
        "url": variant_url,
        "classification": classification,
        "source": "ClinVar"
    }


# ==================== MEDLINEPLUS SCRAPER ====================

def search_medlineplus(gene: str) -> Dict:
    """
    Fetch gene information from MedlinePlus Genetics.
    
    Args:
        gene: Gene symbol (e.g., "BRCA1")
    
    Returns:
        Dict containing:
            - title: Page title
            - text: Full extracted text
            - url: MedlinePlus page URL
            - source: "MedlinePlus"
            - error: Error message if failed
    
    Example:
        result = search_medlineplus("BRCA1")
        print(result["text"])
    """
    gene = gene.strip().upper()
    
    # MedlinePlus uses lowercase gene names in URLs
    url = f"https://medlineplus.gov/genetics/gene/{gene.lower()}/"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
    }
    
    print(f"[MedlinePlus] Fetching: {url}")
    _rate_limit("medlineplus.gov", 0.5)  # Max 0.5 requests per second (slower)
    
    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        return {
            "error": f"Fetch failed: {str(e)}",
            "url": url,
            "source": "MedlinePlus"
        }
    
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # Extract title
    title = soup.title.string.strip() if soup.title else f"MedlinePlus: {gene}"
    
    # Remove navigation and scripts
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    
    # Extract main content container
    main_content = soup.select_one("main") or soup.select_one("article") or soup.find("body")
    
    if not main_content:
        return {
            "error": f"No content found for gene {gene}",
            "url": url,
            "source": "MedlinePlus"
        }
    
    # Convert HTML to Markdown
    markdown_text = md(
        str(main_content),
        heading_style="ATX",
        bullets="-",
        strip=["script", "style", "img"],
        escape_asterisks=False,
        escape_underscores=False
    )
    
    # Clean up excessive whitespace
    lines = [line.strip() for line in markdown_text.split('\n')]
    lines = [line for line in lines if line and len(line) > 10]  # Filter very short lines
    full_text = '\n\n'.join(lines)
    
    if not full_text or len(full_text) < 100:
        return {
            "error": f"No meaningful content found for gene {gene}",
            "url": url,
            "source": "MedlinePlus"
        }
    
    # Limit size
    if len(full_text) > 50000:
        full_text = full_text[:50000] + "\n\n[Content truncated for length]"
    
    print(f"[MedlinePlus] Success - {len(full_text)} characters of markdown")
    
    return {
        "title": title,
        "text": full_text,
        "url": url,
        "source": "MedlinePlus"
    }


# ==================== COMBINED SEARCH ====================

def search_all_sources(gene: str, mutation: str) -> Dict:
    """
    Search both ClinVar and MedlinePlus, return combined results.
    
    Args:
        gene: Gene symbol (e.g., "BRCA1")
        mutation: Mutation/variant (e.g., "c.68_69del")
    
    Returns:
        Dict containing:
            - clinvar: Dict with ClinVar results
            - medlineplus: Dict with MedlinePlus results
            - combined_text: Merged text from both sources
            - classification: From ClinVar
            - sources_used: List of successful sources
    
    Example:
        results = search_all_sources("BRCA1", "c.68_69del")
        print(results["combined_text"])
        print(f"Classification: {results['classification']}")
    """
    print(f"\n=== Fetching genetic data for {gene} {mutation} ===\n")
    
    # Fetch from both sources
    clinvar_result = search_clinvar(gene, mutation)
    medlineplus_result = search_medlineplus(gene)
    
    # Combine results with markdown formatting
    combined_parts = []
    sources_used = []
    
    if "error" not in clinvar_result:
        combined_parts.append(f"""# ClinVar Data

**Source URL**: {clinvar_result['url']}

---

{clinvar_result['text']}""")
        sources_used.append("ClinVar")
    
    if "error" not in medlineplus_result:
        combined_parts.append(f"""# MedlinePlus Genetics Data

**Source URL**: {medlineplus_result['url']}

---

{medlineplus_result['text']}""")
        sources_used.append("MedlinePlus")
    
    combined_text = "\n\n---\n\n".join(combined_parts)
    
    return {
        "clinvar": clinvar_result,
        "medlineplus": medlineplus_result,
        "combined_text": combined_text,
        "classification": clinvar_result.get("classification") if "error" not in clinvar_result else None,
        "sources_used": sources_used,
        "gene": gene,
        "mutation": mutation
    }


# ==================== EXAMPLE USAGE ====================

if __name__ == "__main__":
    """
    Example usage - can be run standalone for testing
    """
    
    # Example 1: Search ClinVar only
    print("\n--- Example 1: ClinVar Search ---")
    result = search_clinvar("BRCA1", "c.68_69del")
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print(f"Title: {result['title']}")
        print(f"URL: {result['url']}")
        print(f"Classification: {result['classification']}")
        print(f"Text preview: {result['text'][:200]}...")
    
    # Example 2: Search MedlinePlus only
    print("\n--- Example 2: MedlinePlus Search ---")
    result = search_medlineplus("BRCA1")
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print(f"Title: {result['title']}")
        print(f"URL: {result['url']}")
        print(f"Text preview: {result['text'][:200]}...")
    
    # Example 3: Search both sources
    print("\n--- Example 3: Combined Search ---")
    results = search_all_sources("BRCA1", "c.68_69del")
    print(f"Gene: {results['gene']}")
    print(f"Mutation: {results['mutation']}")
    print(f"Classification: {results['classification']}")
    print(f"Sources used: {', '.join(results['sources_used'])}")
    print(f"\nCombined text length: {len(results['combined_text'])} characters")
    print(f"Preview:\n{results['combined_text'][:300]}...")

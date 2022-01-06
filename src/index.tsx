import {
  ActionPanel,
  CopyToClipboardAction,
  List,
  OpenInBrowserAction,
  showToast,
  ToastStyle,
  randomId,
  Icon,
} from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import fetch, { AbortError } from "node-fetch";

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List
      isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Search Google or type a URL..."
      throttle
    >
      <List.Section title="Results" subtitle={state.results.length + ""}>
        {state.results.map((searchResult) => (
          <SearchListItem key={searchResult.id} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }: { searchResult: SearchResult }) {
  return (
    <List.Item
      title={searchResult.query}
      subtitle={searchResult.description}
      icon={searchResult.isSearch ? Icon.MagnifyingGlass : Icon.Link}
      actions={
        <ActionPanel>
          <OpenInBrowserAction title="Open in Browser" url={searchResult.url} />
          <CopyToClipboardAction title="Copy URL to Clipboard" content={searchResult.url} />
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  async function search(searchText: string) {
    cancelRef.current?.abort();
    cancelRef.current = new AbortController();

    try {
      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));

      const results = await performSearch(searchText, cancelRef.current.signal);

      setState((oldState) => ({
        ...oldState,
        results: results,
        isLoading: false,
      }));
    } catch (error) {
      if (error instanceof AbortError) {
        return;
      }

      console.error("search error", error);

      showToast(ToastStyle.Failure, "Could not perform search", String(error));
    }
  }

  return {
    state: state,
    search: search,
  };
}

async function performSearch(searchText: string, signal: AbortSignal): Promise<SearchResult[]> {
  if (searchText.length === 0) {
    return [];
  }

  const response = await fetch(
    `http://suggestqueries.google.com/complete/search?hl=en-us&output=chrome&q=${encodeURIComponent(searchText)}`,
    {
      method: "get",
      signal: signal,
    }
  );

  if (!response.ok) {
    return Promise.reject(response.statusText);
  }

  const json: any = await response.json();

  const results: SearchResult[] = [
    {
      id: randomId(),
      query: searchText,
      description: `Search Google for '${searchText}'`,
      url: `https://www.google.com/search?q=${encodeURIComponent(searchText)}`,
      isSearch: true,
    },
  ];

  json[1].map((item: string, i: number) => {
    const type = json[4]["google:suggesttype"][i];
    const description = json[2][i];

    if (type === "NAVIGATION") {
      results[i + 1] = {
        id: randomId(),
        query: description.length > 0 ? description : item,
        description: `Open URL for '${item}'`,
        url: item,
        isSearch: false,
      };
    } else if (type === "QUERY") {
      results[i + 1] = {
        id: randomId(),
        query: item,
        description: `Search Google for '${item}'`,
        url: `https://www.google.com/search?q=${encodeURIComponent(item)}`,
        isSearch: true,
      };
    }
  });

  return results;
}

interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
}

interface SearchResult {
  id: string;
  description?: string;
  query: string;
  url: string;
  isSearch: boolean;
}

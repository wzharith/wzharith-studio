#!/usr/bin/env python3
"""
WZHarith Music - Song Analytics
Analyzes the Archive folder to generate performance statistics.
"""

import os
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def normalize_song_name(filename: str) -> tuple[str, str]:
    """
    Extract and normalize song name and artist from filename.
    Returns (song_name, artist)
    """
    # Remove file extension
    name = Path(filename).stem

    # Remove common prefixes like [Bonus], numbers, etc.
    name = re.sub(r'^\[Bonus\]\s*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'^\d+[a-z]?\.\s*', '', name)

    # Remove key/version info in parentheses at the end
    name = re.sub(r'\s*\([^)]*(?:KEY|key|Extended|Cut|Karaoke|KARAOKE|Entrance|Surprise|Bonus|\+\d+|-\d+|No Vocal)[^)]*\)\s*$', '', name)
    name = re.sub(r'\s*\(\+\d+\)\s*$', '', name)
    name = re.sub(r'\s*\(-\d+\)\s*$', '', name)

    # Try to split artist and song
    # Common patterns: "Artist - Song" or "Song - Artist"
    if ' - ' in name:
        parts = name.split(' - ', 1)

        # List of known artists to help determine order
        known_artists = [
            'Elvis Presley', 'Christina Perri', 'Ed Sheeran', 'Stephen Sanchez',
            'Afgan', 'Siti Nurhaliza', 'Shane Filan', 'Lionel Richi', 'Lionel Richie',
            'Ruth S', 'Innuendo', 'Anuar Zain', 'P. Ramlee', 'P Ramlee',
            'Kenny G', 'Adele', 'Lee Hi', 'Mariah Carey', 'Phil Collins',
            'Loren Allred', 'Lana Del Ray', 'George Benson', 'Krisdayanti',
            'Alexandra', 'Andmesh Kamaleng', 'Hafiz Suip', 'Nadhif Basalamah',
            'Arvian Dwi', 'Banda Neira', 'R. Ismail', 'Rafeah Buang',
            'Taylor Swift', 'Myles Smith', 'Maher Zain'
        ]

        # Check if first part looks like an artist
        first_is_artist = any(artist.lower() in parts[0].lower() for artist in known_artists)
        second_is_artist = any(artist.lower() in parts[1].lower() for artist in known_artists)

        if first_is_artist and not second_is_artist:
            artist, song = parts[0].strip(), parts[1].strip()
        elif second_is_artist and not first_is_artist:
            song, artist = parts[0].strip(), parts[1].strip()
        else:
            # Default: assume "Artist - Song" format
            artist, song = parts[0].strip(), parts[1].strip()

        return song, artist

    return name.strip(), "Unknown"


def parse_event_folder(folder_name: str) -> dict:
    """
    Parse event folder name to extract event details.
    Format: YYYYMMDD Event Type Name
    """
    match = re.match(r'^(\d{8})\s+(\w+)\s+(.+)$', folder_name)
    if match:
        date_str, event_type, name = match.groups()
        try:
            date = datetime.strptime(date_str, '%Y%m%d')
            return {
                'date': date,
                'type': event_type,
                'name': name,
                'folder': folder_name
            }
        except ValueError:
            pass

    return {
        'date': None,
        'type': 'Unknown',
        'name': folder_name,
        'folder': folder_name
    }


def analyze_archive(archive_path: str) -> dict:
    """
    Analyze the Archive folder and return statistics.
    """
    archive = Path(archive_path)

    if not archive.exists():
        raise FileNotFoundError(f"Archive folder not found: {archive_path}")

    # Data structures
    song_counts = Counter()
    artist_counts = Counter()
    songs_by_event = defaultdict(list)
    events = []
    event_types = Counter()
    songs_by_year = defaultdict(Counter)
    all_songs = []

    # Audio file extensions
    audio_extensions = {'.mp3', '.wav', '.m4a', '.flac', '.ogg'}

    # Process each event folder
    for event_folder in sorted(archive.iterdir()):
        if not event_folder.is_dir():
            continue

        event_info = parse_event_folder(event_folder.name)
        events.append(event_info)
        event_types[event_info['type']] += 1

        # Process songs in event folder
        for song_file in event_folder.iterdir():
            if song_file.is_file() and song_file.suffix.lower() in audio_extensions:
                song_name, artist = normalize_song_name(song_file.name)

                # Skip non-song files
                if any(skip in song_name.lower() for skip in ['karaoke', 'repertoire']):
                    continue

                song_key = f"{song_name} - {artist}"
                song_counts[song_key] += 1
                artist_counts[artist] += 1
                songs_by_event[event_folder.name].append(song_key)

                if event_info['date']:
                    year = event_info['date'].year
                    songs_by_year[year][song_key] += 1

                all_songs.append({
                    'song': song_name,
                    'artist': artist,
                    'event': event_folder.name,
                    'date': event_info['date'],
                    'type': event_info['type']
                })

    return {
        'song_counts': song_counts,
        'artist_counts': artist_counts,
        'songs_by_event': dict(songs_by_event),
        'events': events,
        'event_types': event_types,
        'songs_by_year': dict(songs_by_year),
        'all_songs': all_songs,
        'total_events': len(events),
        'total_songs_played': len(all_songs),
        'unique_songs': len(song_counts)
    }


def generate_report(stats: dict) -> str:
    """
    Generate a formatted report from the statistics.
    """
    lines = []
    lines.append("=" * 60)
    lines.append("WZHARITH MUSIC - PERFORMANCE STATISTICS REPORT")
    lines.append("=" * 60)
    lines.append("")

    # Summary
    lines.append("## SUMMARY")
    lines.append("-" * 40)
    lines.append(f"Total Events:        {stats['total_events']}")
    lines.append(f"Total Songs Played:  {stats['total_songs_played']}")
    lines.append(f"Unique Songs:        {stats['unique_songs']}")
    lines.append(f"Unique Artists:      {len(stats['artist_counts'])}")
    lines.append("")

    # Event breakdown
    lines.append("## EVENT TYPES")
    lines.append("-" * 40)
    for event_type, count in stats['event_types'].most_common():
        lines.append(f"  {event_type}: {count}")
    lines.append("")

    # Top songs
    lines.append("## TOP 20 MOST PLAYED SONGS")
    lines.append("-" * 40)
    for i, (song, count) in enumerate(stats['song_counts'].most_common(20), 1):
        pct = (count / stats['total_events']) * 100
        lines.append(f"  {i:2}. {song}")
        lines.append(f"      Played: {count}x ({pct:.0f}% of events)")
    lines.append("")

    # Top artists
    lines.append("## TOP 15 ARTISTS")
    lines.append("-" * 40)
    for i, (artist, count) in enumerate(stats['artist_counts'].most_common(15), 1):
        if artist != "Unknown":
            lines.append(f"  {i:2}. {artist}: {count} songs")
    lines.append("")

    # Language analysis
    malay_artists = ['Afgan', 'Siti Nurhaliza', 'Innuendo', 'Anuar Zain', 'P. Ramlee',
                     'Ruth S', 'Krisdayanti', 'Alexandra', 'Andmesh Kamaleng',
                     'Hafiz Suip', 'Nadhif Basalamah', 'Arvian Dwi', 'Banda Neira',
                     'R. Ismail']

    malay_count = sum(count for artist, count in stats['artist_counts'].items()
                      if any(ma.lower() in artist.lower() for ma in malay_artists))
    english_count = stats['total_songs_played'] - malay_count

    lines.append("## LANGUAGE DISTRIBUTION")
    lines.append("-" * 40)
    lines.append(f"  English Songs: {english_count} ({english_count/stats['total_songs_played']*100:.1f}%)")
    lines.append(f"  Malay/Indo Songs: {malay_count} ({malay_count/stats['total_songs_played']*100:.1f}%)")
    lines.append("")

    # Yearly breakdown
    lines.append("## YEARLY PERFORMANCE")
    lines.append("-" * 40)
    for year in sorted(stats['songs_by_year'].keys()):
        year_songs = stats['songs_by_year'][year]
        total = sum(year_songs.values())
        events_this_year = sum(1 for e in stats['events'] if e['date'] and e['date'].year == year)
        lines.append(f"  {year}: {events_this_year} events, {total} songs played")
    lines.append("")

    # Signature songs (played at 50%+ of events)
    lines.append("## YOUR SIGNATURE SONGS (50%+ of events)")
    lines.append("-" * 40)
    threshold = stats['total_events'] * 0.5
    for song, count in stats['song_counts'].most_common():
        if count >= threshold:
            pct = (count / stats['total_events']) * 100
            lines.append(f"  ★ {song} ({pct:.0f}%)")
    lines.append("")

    # Songs played only once (to expand)
    lines.append("## SONGS TO POTENTIALLY EXPAND (played only 1-2 times)")
    lines.append("-" * 40)
    rare_songs = [(song, count) for song, count in stats['song_counts'].items() if count <= 2]
    for song, count in sorted(rare_songs, key=lambda x: x[0])[:15]:
        lines.append(f"  - {song} ({count}x)")
    lines.append("")

    lines.append("=" * 60)
    lines.append("Report generated: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    lines.append("=" * 60)

    return "\n".join(lines)


def export_to_csv(stats: dict, output_path: str):
    """
    Export song statistics to CSV format.
    """
    import csv

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Rank', 'Song', 'Artist', 'Times Played', 'Percentage'])

        for i, (song_key, count) in enumerate(stats['song_counts'].most_common(), 1):
            if ' - ' in song_key:
                parts = song_key.rsplit(' - ', 1)
                song, artist = parts[0], parts[1]
            else:
                song, artist = song_key, 'Unknown'
            pct = (count / stats['total_events']) * 100
            writer.writerow([i, song, artist, count, f"{pct:.1f}%"])


def main():
    """
    Main function to run the analytics.
    """
    # Determine archive path
    script_dir = Path(__file__).parent.parent
    archive_path = script_dir / "Archive"

    # Alternative: use command line argument
    import sys
    if len(sys.argv) > 1:
        archive_path = Path(sys.argv[1])

    print(f"Analyzing archive: {archive_path}")
    print()

    try:
        stats = analyze_archive(str(archive_path))
        report = generate_report(stats)
        print(report)

        # Save report to file
        report_path = script_dir / "stats" / "performance_report.txt"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\nReport saved to: {report_path}")

        # Export CSV
        csv_path = script_dir / "stats" / "song_statistics.csv"
        export_to_csv(stats, str(csv_path))
        print(f"CSV exported to: {csv_path}")

    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())

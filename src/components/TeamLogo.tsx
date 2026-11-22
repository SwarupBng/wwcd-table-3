import type { Team } from '../types';
import { initials, teamHue } from '../logic/tournament';

interface Props {
  team: Team;
  size?: number;
}

export function TeamLogo({ team, size = 28 }: Props) {
  if (team.logoMode === 'none') {
    return <span className="team-logo-spacer" style={{ width: size, height: size }} />;
  }
  if (team.logoMode === 'upload' && team.logo) {
    return (
      <img
        className="team-logo-img"
        src={team.logo}
        alt=""
        style={{ width: size, height: size }}
      />
    );
  }
  const hue = teamHue(team.name);
  return (
    <span
      className="team-logo-initials"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(135deg, hsl(${hue} 70% 48%), hsl(${(hue + 40) % 360} 70% 38%))`,
      }}
    >
      {initials(team.name)}
    </span>
  );
}

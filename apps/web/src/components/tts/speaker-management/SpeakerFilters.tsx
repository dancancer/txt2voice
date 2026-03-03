import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SpeakerFiltersProps {
  searchTerm: string;
  filterGender: string;
  filterAgeGroup: string;
  filterActive: string;
  onSearchTermChange: (value: string) => void;
  onFilterGenderChange: (value: string) => void;
  onFilterAgeGroupChange: (value: string) => void;
  onFilterActiveChange: (value: string) => void;
}

export function SpeakerFilters({
  searchTerm,
  filterGender,
  filterAgeGroup,
  filterActive,
  onSearchTermChange,
  onFilterGenderChange,
  onFilterAgeGroupChange,
  onFilterActiveChange,
}: SpeakerFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div>
        <Label htmlFor="search">搜索</Label>
        <Input
          id="search"
          placeholder="搜索说话人名称或描述"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="gender">性别</Label>
        <Select value={filterGender} onValueChange={onFilterGenderChange}>
          <SelectTrigger>
            <SelectValue placeholder="选择性别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部</SelectItem>
            <SelectItem value="unknown">未知</SelectItem>
            <SelectItem value="male">男性</SelectItem>
            <SelectItem value="female">女性</SelectItem>
            <SelectItem value="neutral">中性</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="ageGroup">年龄段</Label>
        <Select value={filterAgeGroup} onValueChange={onFilterAgeGroupChange}>
          <SelectTrigger>
            <SelectValue placeholder="选择年龄段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部</SelectItem>
            <SelectItem value="child">儿童</SelectItem>
            <SelectItem value="teen">青少年</SelectItem>
            <SelectItem value="adult">成人</SelectItem>
            <SelectItem value="senior">老年</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="active">状态</Label>
        <Select value={filterActive} onValueChange={onFilterActiveChange}>
          <SelectTrigger>
            <SelectValue placeholder="选择状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部</SelectItem>
            <SelectItem value="true">活跃</SelectItem>
            <SelectItem value="false">非活跃</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck, StickyNote, Flag, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  saveBookmark,
  removeBookmark,
  isBookmarked,
  saveNote,
  getNote,
  deleteNote,
  saveReport,
} from '@/lib/storage';
import { cn } from '@/lib/utils';

interface QuestionActionsProps {
  questionId: string;
  quizId: string;
  className?: string;
  compact?: boolean;
}

export function QuestionActions({
  questionId,
  quizId,
  className,
  compact = false,
}: QuestionActionsProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [hasNote, setHasNote] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportType, setReportType] = useState<string>('');
  const [reportDescription, setReportDescription] = useState('');

  useEffect(() => {
    setBookmarked(isBookmarked(questionId, quizId));
    const existingNote = getNote(questionId, quizId);
    if (existingNote) {
      setNoteContent(existingNote.content);
      setHasNote(true);
    }
  }, [questionId, quizId]);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(questionId, quizId);
      setBookmarked(false);
    } else {
      saveBookmark({
        questionId,
        quizId,
        createdAt: Date.now(),
      });
      setBookmarked(true);
    }
  };

  const handleSaveNote = () => {
    if (noteContent.trim()) {
      saveNote({
        questionId,
        quizId,
        content: noteContent.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setHasNote(true);
    } else {
      deleteNote(questionId, quizId);
      setHasNote(false);
    }
    setNoteDialogOpen(false);
  };

  const handleSubmitReport = () => {
    if (reportType && reportDescription.trim()) {
      saveReport({
        questionId,
        quizId,
        type: reportType as 'incorrect-answer' | 'outdated' | 'unclear' | 'typo' | 'other',
        description: reportDescription.trim(),
        createdAt: Date.now(),
      });
      setReportDialogOpen(false);
      setReportType('');
      setReportDescription('');
    }
  };

  const buttonSize = compact ? 'icon' : 'sm';
  const iconSize = compact ? 'h-4 w-4' : 'h-4 w-4';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Bookmark Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={buttonSize}
            onClick={toggleBookmark}
            className={cn(
              bookmarked && 'text-yellow-500 hover:text-yellow-600'
            )}
            aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            {bookmarked ? (
              <BookmarkCheck className={iconSize} />
            ) : (
              <Bookmark className={iconSize} />
            )}
            {!compact && <span className="ml-1">{bookmarked ? 'Saved' : 'Save'}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
        </TooltipContent>
      </Tooltip>

      {/* Note Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={buttonSize}
            onClick={() => setNoteDialogOpen(true)}
            className={cn(hasNote && 'text-blue-500 hover:text-blue-600')}
            aria-label={hasNote ? 'Edit note' : 'Add note'}
          >
            <StickyNote className={iconSize} />
            {!compact && <span className="ml-1">{hasNote ? 'Edit Note' : 'Note'}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasNote ? 'Edit your note' : 'Add a note'}
        </TooltipContent>
      </Tooltip>

      {/* Report Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={buttonSize}
            onClick={() => setReportDialogOpen(true)}
            aria-label="Report issue"
          >
            <Flag className={iconSize} />
            {!compact && <span className="ml-1">Report</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Report an issue with this question</TooltipContent>
      </Tooltip>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <StickyNote className="h-5 w-5 inline mr-2" />
              Add Note
            </DialogTitle>
            <DialogDescription>
              Add a personal note to help you remember key concepts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Write your note here..."
              value={noteContent}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteContent(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote}>
              {noteContent.trim() ? 'Save Note' : 'Delete Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Flag className="h-5 w-5 inline mr-2" />
              Report Question
            </DialogTitle>
            <DialogDescription>
              Help us improve by reporting issues with this question.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Issue Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incorrect-answer">Incorrect answer marked as correct</SelectItem>
                  <SelectItem value="outdated">Outdated information</SelectItem>
                  <SelectItem value="unclear">Unclear question or options</SelectItem>
                  <SelectItem value="typo">Typo or grammatical error</SelectItem>
                  <SelectItem value="other">Other issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Please describe the issue..."
                value={reportDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReportDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={!reportType || !reportDescription.trim()}
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { memo } from 'react';
import { PendingQuestion } from '../../protocol';
import { useEcaDispatch } from '../../redux/store';
import { answerQuestion, cancelQuestion } from '../../redux/thunks/chat';
import './ChatQuestion.scss';

interface Props {
    chatId: string;
    question: PendingQuestion;
}

export const ChatQuestion = memo(({ chatId, question }: Props) => {
    const dispatch = useEcaDispatch();

    const handleOptionClick = (label: string) => {
        dispatch(answerQuestion({ chatId, answer: label }));
    };

    const handleCancel = () => {
        dispatch(cancelQuestion({ chatId }));
    };

    return (
        <div className="chat-question">
            <div className="chat-question__header">Q: {question.question}</div>
            <div className="chat-question__options">
                {(question.options ?? []).map((option, index) => (
                    <div key={index} className="chat-question__option" onClick={() => handleOptionClick(option.label)}>
                        <span className="chat-question__option-label">{option.label}</span>
                        {option.description && (
                            <span className="chat-question__option-desc">{option.description}</span>
                        )}
                    </div>
                ))}
                <div className="chat-question__option chat-question__option--cancel" onClick={handleCancel}>
                    <span className="chat-question__option-label">Cancel</span>
                </div>
            </div>
        </div>
    );
});
